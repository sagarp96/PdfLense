# Take-Home Assignment: Build a Google NotebookLM Clone

# Objective

Develop an web-based application using React or Angular and a backend of your choosing, that enables users to upload and interact with PDF documents through a chat interface. The system should efficiently extract relevant information while minimizing token usage.

# Feature Requirements

PDF Upload and Viewing
Implement functionality for users to upload large PDF files.
Integrate a built-in PDF viewer that allows users to navigate through the uploaded document.
Chat Interface
Develop a chat screen where users can inquire about the contents of the uploaded PDF and pose other related questions.
Ensure that responses are efficient and utilize a minimal number of tokens.
Citation & Navigation
Provide citations in the form of buttons within each response, referencing specific pages of the PDF.
Clicking a citation button should open or scroll to the referenced page in the PDF viewer.

# Implementation Hints

AI Integration: Consider leveraging available AI APIs and tools to facilitate efficient data extraction and interaction.
Vectorization of PDFs: To enhance searchability and interaction within the PDF, explore vectorization techniques. Tools like LlamaParse by LlamaIndex can convert complex PDFs into markdown, making them ready for vectorization and use in retrieval-augmented generation (RAG) systems.
Framework Choice: Utilize the component-based architecture of React or Angular to create a modular and maintainable codebase. For backend feel free to use the tech stack most suitable for you.
Performance Optimization: Optimize the application to handle large PDFs efficiently, ensuring minimal memory consumption and fast load times.
User Interface Design: Design a clean and intuitive user interface that facilitates easy navigation and interaction with the PDF and chat features. (reference below)

# Deliverables

A fully functional application.
Well-documented source code.
A README file with installation, setup, and usage instructions.
The app should be accessible via a URL. (can use free cloud providers like netlify, render etc)
