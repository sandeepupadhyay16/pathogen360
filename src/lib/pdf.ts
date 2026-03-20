'use client';

import jsPDF from 'jspdf';

export const downloadReportAsPdf = async (reportId: string) => {
    try {
        const res = await fetch(`/api/report/${reportId}`);
        if (!res.ok) throw new Error('Failed to fetch report data');
        const report = await res.json();

        const doc = new jsPDF();
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const contentWidth = pageWidth - (margin * 2);
        let y = 25;

        // --- Header Section ---
        doc.setFillColor(240, 245, 255);
        doc.rect(0, 0, pageWidth, 40, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(30, 58, 138); // blue-900
        doc.text('Medical 360: Analysis Report', margin, 20);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); // gray-400
        doc.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin, 32);

        y = 55;

        // --- Report Title ---
        doc.setFontSize(18);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(`Target: ${report.name}`, margin, y);
        y += 15;

        // Section Content
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85); // slate-700

        const textContent = report.synthesizedContext || 'Knowledge Nucleus data not available. Please run synthesis.';
        const lines = doc.splitTextToSize(textContent, contentWidth);

        // Handle multi-page text content
        lines.forEach((line: string) => {
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
            doc.text(line, margin, y);
            y += 5.5;
        });

        // --- Footer ---
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184); // slate-400
            doc.text(
                `Confidential Internal Use Only | Page ${i} of ${pageCount}`,
                pageWidth / 2,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'center' }
            );
        }

        doc.save(`Medical360_Report_${report.name.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
        console.error('PDF Generation Error:', error);
        throw error;
    }
};
