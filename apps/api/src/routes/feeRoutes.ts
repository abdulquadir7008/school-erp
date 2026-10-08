import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorization";
import { validate } from "../middleware/errorHandler";
import { feeController } from "../controllers/feeController";
import { PERMISSIONS } from "../constants/permissions";
import {
  createAcademicYearSchema,
  updateAcademicYearSchema,
  createStructureSchema,
  updateStructureSchema,
  generateInvoicesSchema,
  applyFineSchema,
  sendReceiptSchema,
  createInvoiceSchema,
  createPaymentSchema,
} from "../validators/feeValidator";

const router = Router();

router.use(authenticate);

// ---- Dashboard ----------------------------------------------------
router.get("/dashboard", authorize(PERMISSIONS.FEES_VIEW), feeController.dashboard);

// ---- Academic years ------------------------------------------------
router.get("/academic-years", authorize(PERMISSIONS.FEES_VIEW), feeController.listAcademicYears);
router.post(
  "/academic-years",
  authorize(PERMISSIONS.FEES_MANAGE),
  validate(createAcademicYearSchema),
  feeController.createAcademicYear
);
router.put(
  "/academic-years/:id",
  authorize(PERMISSIONS.FEES_MANAGE),
  validate(updateAcademicYearSchema),
  feeController.updateAcademicYear
);
router.post(
  "/academic-years/:id/current",
  authorize(PERMISSIONS.FEES_MANAGE),
  feeController.setCurrentAcademicYear
);

// ---- Categories ----------------------------------------------------
router.get("/categories", authorize(PERMISSIONS.FEES_VIEW), feeController.listCategories);

// ---- Fee structures ------------------------------------------------
router.get("/structures", authorize(PERMISSIONS.FEES_VIEW), feeController.listStructures);
router.post(
  "/structures",
  authorize(PERMISSIONS.FEES_MANAGE),
  validate(createStructureSchema),
  feeController.createStructure
);
router.put(
  "/structures/:id",
  authorize(PERMISSIONS.FEES_MANAGE),
  validate(updateStructureSchema),
  feeController.updateStructure
);
router.delete(
  "/structures/:id",
  authorize(PERMISSIONS.FEES_MANAGE),
  feeController.deleteStructure
);

// ---- Invoice generation ---------------------------------------------
router.post(
  "/generate-invoices",
  authorize(PERMISSIONS.FEES_MANAGE),
  validate(generateInvoicesSchema),
  feeController.generateInvoices
);

// ---- Invoices -------------------------------------------------------
router.get("/invoices", authorize(PERMISSIONS.FEES_VIEW), feeController.listInvoices);
router.get("/invoices/:id", authorize(PERMISSIONS.FEES_VIEW), feeController.getInvoice);
router.get("/invoices/:id/pdf", authorize(PERMISSIONS.FEES_VIEW), feeController.getInvoicePdf);
router.post(
  "/invoices/:id/fine",
  authorize(PERMISSIONS.FEES_MANAGE),
  validate(applyFineSchema),
  feeController.applyFine
);
router.post(
  "/invoices/:id/send-receipt",
  authorize(PERMISSIONS.FEES_COLLECT),
  validate(sendReceiptSchema),
  feeController.sendReceipt
);
router.post(
  "/invoices",
  authorize(PERMISSIONS.FEES_COLLECT),
  validate(createInvoiceSchema),
  feeController.createInvoice
);

// ---- Payments -------------------------------------------------------
router.post(
  "/payments",
  authorize(PERMISSIONS.FEES_COLLECT),
  validate(createPaymentSchema),
  feeController.collectPayment
);

// ---- Student history ------------------------------------------------
router.get(
  "/students/:studentId/payments",
  authorize(PERMISSIONS.FEES_VIEW),
  feeController.getStudentHistory
);

// ---- Reports ----------------------------------------------------------
router.get("/reports/pending", authorize(PERMISSIONS.FEES_REPORT), feeController.pendingReport);
router.get("/reports/pending-pdf", authorize(PERMISSIONS.FEES_REPORT), feeController.pendingReportPdf);

export default router;