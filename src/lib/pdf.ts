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
        doc.text('Pathogen 360: Market Analysis', margin, 20);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); // gray-400
        doc.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin, 32);

        y = 55;

        // --- Report Title ---
        doc.setFontSize(18);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(`Target: ${report.pathogen.name}`, margin, y);
        y += 15;

        const sections = [
            { title: 'Taxonomy & Biology', content: report.pathogen.taxonomy || report.pathogen.biology || report.taxonomy },
            { title: 'Epidemiology', content: report.epidemiology },
            { title: 'Target Population', content: report.populationSize },
            { title: 'Vaccine Landscape', content: report.vaccineLandscape },
            { title: 'Market Potential & Gaps', content: report.marketPotential }
        ];

        sections.forEach((s) => {
            // Check for page break before section header
            if (y > 260) {
                doc.addPage();
                y = 20;
            }

            // Section Header
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(37, 99, 235); // blue-600
            doc.text(s.title.toUpperCase(), margin, y);
            y += 7;

            // Horizontal line
            doc.setDrawColor(226, 232, 240);
            doc.line(margin, y, pageWidth - margin, y);
            y += 8;

            // Section Content
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(51, 65, 85); // slate-700

            const textContent = s.content || 'Data not available for this segment.';
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

            y += 10; // Space between sections
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

        doc.save(`Pathogen360_Report_${report.pathogen.name.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
        console.error('PDF Generation Error:', error);
        throw error;
    }
};
