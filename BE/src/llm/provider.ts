export interface LLMProvider {
  generateStructured<T>(prompt: string, schema: object): Promise<T>;
}
