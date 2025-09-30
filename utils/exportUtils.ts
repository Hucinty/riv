import { jsPDF } from 'jspdf';
import { UserInfo } from '../types';

export const generateContent = (userInfo: UserInfo, facts: string[]): string => {
  let content = `Information Profile for ${userInfo.name}\n`;
  content += `AI Companion Name: ${userInfo.aiName}\n`;
  content += `-----------------------------------------\n\n`;
  content += "Key Information Remembered:\n\n";
  if (facts.length > 0) {
    facts.forEach((fact, index) => {
      content += `${index + 1}. ${fact}\n`;
    });
  } else {
    content += "Nothing specific has been learned yet. Let's chat more!\n";
  }
  return content;
};

const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export const exportAsTxt = (userInfo: UserInfo, facts: string[]) => {
  const content = generateContent(userInfo, facts);
  const blob = new Blob([content], { type: 'text/plain' });
  triggerDownload(blob, `AI_Friend_Info_${userInfo.name}.txt`);
};

export const exportAsPdf = (userInfo: UserInfo, facts: string[]) => {
  const doc = new jsPDF();
  const content = generateContent(userInfo, facts);

  doc.setFont('Helvetica');
  doc.setFontSize(12);
  doc.text(content, 10, 10, { maxWidth: 180 });
  doc.save(`AI_Friend_Info_${userInfo.name}.pdf`);
};
