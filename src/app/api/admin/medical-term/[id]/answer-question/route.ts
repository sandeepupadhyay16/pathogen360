import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createOperation } from '@/lib/operations';
import { executeAnswerQuestionTask } from '@/lib/tasks/answer';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: medicalTermId } = await params;
        const body = await request.json();
        const { questionId, forceRecompute = false } = body;

        if (!medicalTermId || !questionId) {
            return NextResponse.json({ error: 'Medical Term ID and Question ID are required.' }, { status: 400 });
        }

        // Verify medical term existence
        const term = await prisma.medicalTerm.findUnique({ where: { id: medicalTermId } });
        if (!term) {
            return NextResponse.json({ error: 'Medical term not found.' }, { status: 404 });
        }

        // Verify question existence
        const question = await prisma.logicalQuestion.findUnique({ where: { id: questionId } });
        if (!question) {
            return NextResponse.json({ error: 'Logical question not found.' }, { status: 404 });
        }

        // Check for existing running or pending operations for this specific question
        const existingOp = await prisma.operation.findFirst({
            where: {
                status: { in: ['RUNNING', 'PENDING'] },
                type: 'ANSWER_QUESTION' as any,
                target: question.question
            }
        });

        if (existingOp) {
            return NextResponse.json({ 
                message: 'An answering operation is already in progress for this question.',
                operationId: existingOp.id 
            });
        }

        // Create the operation
        const operation = await createOperation('ANSWER_QUESTION' as any, question.question, {
            medicalTermId,
            questionId,
            forceRecompute
        });

        // Fire and forget background task
        executeAnswerQuestionTask(operation.id, { 
            questionId, 
            medicalTermId, 
            forceRecompute 
        }).catch(err => {
            console.error(`[ANSWER_QUESTION] Background task failed for OP:${operation.id}`, err);
        });

        return NextResponse.json({
            message: 'Question answering initiated in background.',
            operationId: operation.id
        });

    } catch (error: any) {
        console.error('[API:ANSWER_QUESTION] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
    }
}
