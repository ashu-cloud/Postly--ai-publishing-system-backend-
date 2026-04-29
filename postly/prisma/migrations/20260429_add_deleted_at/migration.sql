-- Add soft-delete support to Post
ALTER TABLE "Post" ADD COLUMN "deletedAt" TIMESTAMP(3);
