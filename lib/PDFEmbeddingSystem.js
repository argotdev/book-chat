// lib/PDFEmbeddingSystem.js
import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import * as pdfParse from 'pdf-parse/lib/pdf-parse.js';

export class PDFEmbeddingSystem {
  constructor(openaiApiKey, pineconeApiKey, indexName) {
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: openaiApiKey
    });

    // Initialize Pinecone
    this.pc = new Pinecone({
      apiKey: pineconeApiKey,
    });

    this.indexName = indexName;
    this.index = this.pc.index(indexName);
  }

  cleanText(text) {
    // Remove multiple spaces
    text = text.replace(/\s+/g, ' ');
    // Remove multiple newlines
    text = text.replace(/\n+/g, '\n');
    // Remove special characters but keep basic punctuation
    text = text.replace(/[^\w\s.,!?-]/g, '');
    return text.trim();
  }

  chunkText(text, chunkSize = 1000) {
    // Split by sentences using regex
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks = [];
    let currentChunk = "";

    for (const sentence of sentences) {
      if ((currentChunk + " " + sentence).length < chunkSize) {
        currentChunk += (currentChunk ? " " : "") + sentence;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      }
    }

    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
  }

  async extractTextFromPDF(pdfBuffer) {
    try {
      const data = await pdfParse.default(pdfBuffer);
      const text = this.cleanText(data.text);
      
      // Split text into pages based on length (since pdf-parse doesn't maintain page structure)
      const approximatePageLength = Math.ceil(text.length / data.numpages);
      const pdfText = {};
      
      for (let i = 0; i < data.numpages; i++) {
        const start = i * approximatePageLength;
        const end = start + approximatePageLength;
        const pageText = text.slice(start, end);
        
        if (pageText.trim()) {
          pdfText[i + 1] = pageText;
        }
      }

      return pdfText;
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error(`Error extracting text from PDF: ${error.message}`);
    }
  }

  async createEmbedding(text) {
    const response = await this.openai.embeddings.create({
      input: text,
      model: "text-embedding-ada-002"
    });
    return response.data[0].embedding;
  }

  async processPDF(pdfBuffer, pdfName, additionalMetadata = {}) {
    try {
      console.log('Starting PDF processing...');
      
      // Extract text from PDF
      const pdfText = await this.extractTextFromPDF(pdfBuffer);
      
      console.log(`Extracted text from ${Object.keys(pdfText).length} pages`);

      const vectors = [];
      let totalChunks = 0;

      // Process each page
      for (const [pageNum, pageText] of Object.entries(pdfText)) {
        const chunks = this.chunkText(pageText);
        totalChunks += chunks.length;

        console.log(`Processing page ${pageNum}: ${chunks.length} chunks`);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];

          // Create embedding
          const embedding = await this.createEmbedding(chunk);

          // Prepare metadata
          const chunkMetadata = {
            text: chunk,
            pdf_name: pdfName,
            page_number: parseInt(pageNum),
            chunk_index: i,
            total_chunks_in_page: chunks.length,
            ...additionalMetadata
          };

          // Add to vectors array
          vectors.push({
            id: `${pdfName}_p${pageNum}_chunk_${i}`,
            values: embedding,
            metadata: chunkMetadata
          });

          // If we have 100 vectors, upsert them in batch
          if (vectors.length >= 100) {
            await this.index.upsert(vectors);
            console.log(`Upserted batch of ${vectors.length} vectors`);
            vectors.length = 0;
            // Add a small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      // Upsert any remaining vectors
      if (vectors.length > 0) {
        await this.index.upsert(vectors);
        console.log(`Upserted final batch of ${vectors.length} vectors`);
      }

      console.log(`Completed processing PDF. Total chunks: ${totalChunks}`);
      return true;
    } catch (error) {
      console.error('Error in processPDF:', error);
      throw new Error(`Error processing PDF: ${error.message}`);
    }
  }

  async querySimilar(query, topK = 3, filterDict = null) {
    try {
      const queryEmbedding = await this.createEmbedding(query);

      const results = await this.index.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        filter: filterDict
      });

      return results.matches;
    } catch (error) {
      throw new Error(`Error querying similar texts: ${error.message}`);
    }
  }
}