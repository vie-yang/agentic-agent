import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

interface ExportRequest {
    type: 'pdf' | 'excel';
    content: string;
    filename?: string;
    title?: string;
}

// Get base URL for download links
function getBaseUrl(): string {
    return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

// Ensure exports directory exists
function ensureExportsDir(): string {
    const exportDir = join(process.cwd(), 'public', 'exports');
    if (!existsSync(exportDir)) {
        mkdirSync(exportDir, { recursive: true });
    }
    return exportDir;
}

// Parse markdown and render to PDF
function renderMarkdownToPdf(doc: jsPDF, content: string, title?: string): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    // Helper to check and add new page
    const checkNewPage = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
    };

    // Title
    if (title) {
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        const titleLines = doc.splitTextToSize(title, maxWidth);
        checkNewPage(titleLines.length * 8);
        doc.text(titleLines, margin, y);
        y += titleLines.length * 8 + 10;
    }

    // Date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated: ${new Date().toLocaleString('id-ID')}`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 15;

    // Process content line by line
    const lines = content.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        if (!trimmed) {
            y += 5;
            continue;
        }

        // Headers
        if (trimmed.startsWith('### ')) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            const text = trimmed.substring(4);
            const textLines = doc.splitTextToSize(text, maxWidth);
            checkNewPage(textLines.length * 6 + 8);
            y += 6;
            doc.text(textLines, margin, y);
            y += textLines.length * 6 + 4;
            continue;
        }

        if (trimmed.startsWith('## ')) {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            const text = trimmed.substring(3);
            const textLines = doc.splitTextToSize(text, maxWidth);
            checkNewPage(textLines.length * 7 + 10);
            y += 8;
            doc.text(textLines, margin, y);
            y += textLines.length * 7 + 5;
            continue;
        }

        if (trimmed.startsWith('# ')) {
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            const text = trimmed.substring(2);
            const textLines = doc.splitTextToSize(text, maxWidth);
            checkNewPage(textLines.length * 8 + 12);
            y += 10;
            doc.text(textLines, margin, y);
            y += textLines.length * 8 + 6;
            continue;
        }

        // Bullet points
        if (trimmed.match(/^[-*]\s/)) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            const text = '• ' + cleanMarkdown(trimmed.substring(2));
            const textLines = doc.splitTextToSize(text, maxWidth - 10);
            checkNewPage(textLines.length * 5 + 2);
            doc.text(textLines, margin + 5, y);
            y += textLines.length * 5 + 2;
            continue;
        }

        // Numbered list
        if (trimmed.match(/^\d+\.\s/)) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            const text = cleanMarkdown(trimmed);
            const textLines = doc.splitTextToSize(text, maxWidth - 10);
            checkNewPage(textLines.length * 5 + 2);
            doc.text(textLines, margin + 5, y);
            y += textLines.length * 5 + 2;
            continue;
        }

        // Normal text with bold/italic handling
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const text = cleanMarkdown(trimmed);
        const textLines = doc.splitTextToSize(text, maxWidth);
        checkNewPage(textLines.length * 5 + 2);
        doc.text(textLines, margin, y);
        y += textLines.length * 5 + 3;
    }
}

// Clean markdown formatting
function cleanMarkdown(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1')  // Bold
        .replace(/\*(.*?)\*/g, '$1')      // Italic
        .replace(/`([^`]+)`/g, '$1')      // Inline code
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Links
        .trim();
}

// Generate PDF from markdown content
function generatePdf(content: string, title?: string): Buffer {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    renderMarkdownToPdf(doc, content, title);

    // Return as buffer
    const arrayBuffer = doc.output('arraybuffer');
    return Buffer.from(arrayBuffer);
}

// Generate Excel from tabular data
function generateExcel(content: string, title?: string): Buffer {
    let data: Record<string, unknown>[];

    // Try to parse as JSON
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
            data = parsed;
        } else if (parsed.data && Array.isArray(parsed.data)) {
            data = parsed.data;
        } else {
            // Wrap single object in array
            data = [parsed];
        }
    } catch {
        // If not JSON, try to parse markdown table
        data = parseMarkdownTable(content);
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map(key => ({
        wch: Math.max(key.length, ...data.map(row => String(row[key] || '').length))
    }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, title?.substring(0, 31) || 'Data');

    // Write to buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
}

// Parse markdown table to array of objects
function parseMarkdownTable(content: string): Record<string, unknown>[] {
    const lines = content.split('\n').filter(line => line.includes('|'));
    
    if (lines.length < 2) {
        // Return content as single-column data
        return content.split('\n')
            .filter(line => line.trim())
            .map((line, index) => ({ 'No': index + 1, 'Content': cleanMarkdown(line) }));
    }

    // Parse header
    const headerLine = lines[0];
    const headers = headerLine.split('|')
        .map(h => h.trim())
        .filter(h => h && !h.match(/^[-:]+$/));

    // Skip separator line and parse data
    const data: Record<string, unknown>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/^\s*\|?[-:\s|]+\|?\s*$/)) continue; // Skip separator

        const values = line.split('|')
            .map(v => v.trim())
            .filter((_, idx) => idx > 0 && idx <= headers.length);

        if (values.length > 0) {
            const row: Record<string, unknown> = {};
            headers.forEach((header, idx) => {
                row[header] = cleanMarkdown(values[idx] || '');
            });
            data.push(row);
        }
    }

    return data.length > 0 ? data : [{ 'Content': cleanMarkdown(content) }];
}

export async function POST(request: NextRequest) {
    try {
        const body: ExportRequest = await request.json();
        const { type, content, filename, title } = body;

        if (!type || !content) {
            return NextResponse.json(
                { error: 'Type and content are required' },
                { status: 400 }
            );
        }

        if (type !== 'pdf' && type !== 'excel') {
            return NextResponse.json(
                { error: 'Type must be "pdf" or "excel"' },
                { status: 400 }
            );
        }

        const exportDir = ensureExportsDir();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const uniqueId = uuidv4().substring(0, 8);
        
        // Sanitize filename: strip HTML tags, remove special chars, limit length
        console.log(`[Export] Original filename: ${filename}`);
        let baseName = filename || 'export';
        
        // Multiple cleaning passes for robustness
        baseName = baseName.replace(/<[^>]*>/g, ''); // Strip HTML tags like <em>
        baseName = baseName.replace(/&lt;[^&]*&gt;/g, ''); // Strip encoded HTML tags
        baseName = baseName.replace(/%3C[^%]*%3E/gi, ''); // Strip URL-encoded HTML tags
        baseName = baseName.replace(/[^a-zA-Z0-9\-\s]/g, ''); // Remove special chars except space and hyphen
        baseName = baseName.replace(/\s+/g, '-'); // Replace spaces with hyphen (not underscore to avoid markdown italic)
        baseName = baseName.trim();
        baseName = baseName.substring(0, 50) || 'export'; // Limit length
        
        console.log(`[Export] Sanitized filename: ${baseName}`);
        
        let buffer: Buffer;
        let ext: string;
        let mimeType: string;

        if (type === 'pdf') {
            buffer = generatePdf(content, title);
            ext = 'pdf';
            mimeType = 'application/pdf';
        } else {
            buffer = generateExcel(content, title);
            ext = 'xlsx';
            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        }

        const finalFilename = `${baseName}-${timestamp}-${uniqueId}.${ext}`;
        const filePath = join(exportDir, finalFilename);

        writeFileSync(filePath, buffer);

        const downloadUrl = `${getBaseUrl()}/exports/${finalFilename}`;

        console.log(`[Export] Generated ${type.toUpperCase()}: ${finalFilename}`);

        return NextResponse.json({
            success: true,
            downloadUrl,
            filename: finalFilename,
            type,
            mimeType,
        });

    } catch (error) {
        console.error('[Export] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Export failed' },
            { status: 500 }
        );
    }
}
