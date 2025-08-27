import { Hono } from "hono";
import { ImageUploadSchema } from "../validation/image_validation.js";
import { arktypeValidator } from "@hono/arktype-validator";
import { TokenMetadataSchema } from "../validation/metadata_validation.js";
import { PinataSDK } from "pinata";
import { metadataEnv } from "../env.js";

const uploadRouter = new Hono();
const pinata = new PinataSDK({
  pinataJwt: metadataEnv.PINATA_JWT,
  pinataGateway: metadataEnv.PINATA_GATEWAY,
});

uploadRouter.post(
  "/img",
  arktypeValidator("form", ImageUploadSchema, (result, c) => {
    if (!result.success) {
      console.error("Validation Problems:", result.errors.summary);
      return c.text(
        `You have provided an incorrect image:\n${result.errors.summary}`,
        400
      );
    }
  }),
  async (c) => {
    const validatedData = c.req.valid("form");
    const image = validatedData.image;

    try {
      // Process the file
      const upload = await pinata.upload.public.file(image);

      // Get the URL
      const url = await pinata.gateways.public.convert(upload.cid);

      console.log("Image uploaded successfully:");
      console.log("  Filename:", image.name);
      console.log("  Size:", image.size, "bytes");
      console.log("  Type:", image.type);
      console.log("  URL:", url);

      // Send the URL
      return c.text(url);
    } catch (e) {
      console.error("Failed to process image", e);
      return c.text("Failed to process image, please try again later", 500);
    }
  }
);

uploadRouter.post(
  "/meta",
  arktypeValidator("json", TokenMetadataSchema, (result, c) => {
    if (!result.success) {
      console.error("Validation Problems:", result.errors.summary);
      return c.text(
        `You have provided incorrect token metadata:\n${result.errors.summary}`,
        400
      );
    }
  }),
  async (c) => {
    const validatedMeta = c.req.valid("json");

    try {
      // Create file
      const metaFile = new File(
        [JSON.stringify(validatedMeta)],
        `metadata_${Date.now()}.json`,
        { type: "application/json" }
      );

      // Process the file
      const upload = await pinata.upload.public.file(metaFile);

      // Get the URL
      const url = await pinata.gateways.public.convert(upload.cid);
      console.log("Metadata uploaded successfully:");
      console.log("  Metadata:", validatedMeta);
      console.log("  URL:", url);

      return c.text(url);
    } catch (e) {
      console.error("Failed to process metadata", e);
      return c.text("Failed to process metadata, please try again later", 500);
    }
  }
);

export default uploadRouter;
