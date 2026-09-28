import type { MetadataRequestBody } from './types'

function buildMetadataPrompt(maxTitle: MetadataRequestBody['maxTitle'], maxKeywords: MetadataRequestBody['maxKeywords']): string {
  return `Analyze this image and generate metadata for Adobe Stock. \nReturn ONLY a raw JSON object (do not wrap in markdown like \`\`\`json). The structure must be exactly: \n{"title": "A descriptive title max ${maxTitle} chars in English", "keywords": ["keyword1", "keyword2", ...] (max ${maxKeywords} keywords), "category": <number>}\nFor the category, select the most appropriate ID from this Adobe Stock Category list: 1 (Animals), 2 (Buildings and Architecture), 3 (Business), 4 (Drinks), 5 (Environment), 6 (States of Mind), 7 (Food), 8 (Graphic Resources), 9 (Hobbies and Leisure), 10 (Industry), 11 (Landscapes), 12 (Lifestyle), 13 (People), 14 (Plants and Flowers), 15 (Culture and Religion), 16 (Science), 17 (Social Issues), 18 (Sports), 19 (Technology), 20 (Transport), 21 (Travel).`;
}

module.exports = { buildMetadataPrompt }
