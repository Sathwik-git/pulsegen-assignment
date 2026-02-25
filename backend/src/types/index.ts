import { Document, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: string;
  organisation: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IVideo extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  originalName: string;
  filename: string;
  filepath: string;
  mimeType: string;
  size: number;
  duration: number | null;
  resolution: { width: number | null; height: number | null };
  processingStatus: string;
  processingProgress: number;
  processingError: string | null;
  sensitivityClassification: string;
  sensitivityScore: number | null;
  sensitivityDetails: {
    violence: number;
    adult: number;
    language: number;
    drug: number;
  };
  uploadedBy: Types.ObjectId;
  organisation: string;
  visibility: "private" | "organisation" | "public";
  tags: string[];
  category: string;
  isStreamReady: boolean;
  thumbnailPath: string | null;
  createdAt: Date;
  updatedAt: Date;
  formattedSize: string;
}

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
}
