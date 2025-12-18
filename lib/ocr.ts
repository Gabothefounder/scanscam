import vision from "@google-cloud/vision";
import path from "path";



const client = new vision.ImageAnnotatorClient({
  keyFilename: path.join(
    process.cwd(),
    "gcloud-key.json"
  ),
});

export async function ocrImage(base64Image: string): Promise<string> {
  console.log("OCR FUNCTION CALLED");
  console.log("Base64 length:", base64Image.length);

  const cleaned = base64Image.replace(
    /^data:image\/[a-zA-Z]+;base64,/,
    ""
  );

  

  const [result] = await client.textDetection({
    image: {
      content: cleaned,
    },
  });

  const text =
    result.textAnnotations && result.textAnnotations.length > 0
      ? result.textAnnotations[0].description
      : "";

  

  if (!text) return "";
return text.trim();

}
