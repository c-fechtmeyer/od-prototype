import "server-only";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");

// Neon's HTTP driver: one stateless request per query, which suits serverless hosts.
export const sql = neon(url);
