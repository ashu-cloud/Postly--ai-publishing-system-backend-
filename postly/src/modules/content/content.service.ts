
import { generateContent as aiGenerate } from '../../services/ai/openrouter.service';
import type { GenerateContentInput } from './content.schema';

export async function generateContent(userId: string, input: GenerateContentInput) {
  return aiGenerate({
    ...input,
    userId,
  });
}
