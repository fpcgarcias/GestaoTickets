import express, { Response } from "express";
import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertTicketSchema, insertTicketReplySchema } from "@shared/schema";

function validateRequest(schema: z.ZodType<any, any>) {
  return (req: Request, res: Response, next: Function) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors,
        });
      }
      next(error);
    }
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  const router = express.Router();

  // Tickets endpoints - general list
  router.get("/tickets", async (req, res) => {
    try {
      const tickets = await storage.getTickets();
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  // Stats and dashboard endpoints - these must come BEFORE the :id route
  router.get("/tickets/stats", async (_req, res) => {
    try {
      const stats = await storage.getTicketStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ticket stats" });
    }
  });

  router.get("/tickets/recent", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const tickets = await storage.getRecentTickets(limit);
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent tickets" });
    }
  });

  // Individual ticket by ID - must come AFTER specific routes
  router.get("/tickets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ticket ID" });
      }

      const ticket = await storage.getTicket(id);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      res.json(ticket);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ticket" });
    }
  });

  router.post("/tickets", validateRequest(insertTicketSchema), async (req, res) => {
    try {
      const ticket = await storage.createTicket(req.body);
      res.status(201).json(ticket);
    } catch (error) {
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  router.post("/ticket-replies", validateRequest(insertTicketReplySchema), async (req, res) => {
    try {
      const ticketId = req.body.ticketId;
      
      // Check if ticket exists
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      const reply = await storage.createTicketReply(req.body);
      res.status(201).json(reply);
    } catch (error) {
      res.status(500).json({ message: "Failed to create ticket reply" });
    }
  });

  // Customer endpoints
  router.get("/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  // Official endpoints
  router.get("/officials", async (req, res) => {
    try {
      const officials = await storage.getOfficials();
      res.json(officials);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch officials" });
    }
  });

  // Authentication endpoints (mock for now)
  router.post("/auth/login", (req, res) => {
    // In a real app, this would validate credentials
    res.json({
      id: 1,
      username: "admin",
      name: "Admin User",
      email: "admin@example.com",
      role: "admin"
    });
  });

  router.post("/auth/logout", (req, res) => {
    res.json({ success: true });
  });

  router.get("/auth/me", (req, res) => {
    // Mock current user
    res.json({
      id: 1,
      username: "admin",
      name: "Admin User",
      email: "admin@example.com",
      role: "admin"
    });
  });

  // Mount the router at /api
  app.use("/api", router);

  const httpServer = createServer(app);
  return httpServer;
}
