import express from 'express';
import { authenticate, authorize, AuthRequest } from '../middlewares/authMiddleware';
import { asyncHandler } from '../middlewares/errorMiddleware';
import { PropertyService } from '../services/propertyService';
import { createPropertySchema, updatePropertySchema, idParamSchema, paginationSchema } from '../types/schemas';
import { validateRequest } from '../middlewares/validationMiddleware';

const router = express.Router();

// Create property (landlord only)
router.post(
  '/',
  authenticate,
  authorize(['landlord']),
  validateRequest(createPropertySchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const property = await PropertyService.createProperty(req.user!.id, req.body);

    res.status(201).json({
      success: true,
      data: property,
      message: 'Property created successfully',
    });
  })
);

// Get properties (paginated with filters)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const filters = {
      status: req.query.status as string,
      minPrice: req.query.minPrice ? parseInt(req.query.minPrice as string) : undefined,
      maxPrice: req.query.maxPrice ? parseInt(req.query.maxPrice as string) : undefined,
      bedrooms: req.query.bedrooms ? parseInt(req.query.bedrooms as string) : undefined,
      landlordId: req.query.landlordId as string,
      location: req.query.location as string,
    };

    const { properties, total } = await PropertyService.getProperties(page, limit, filters);

    res.json({
      success: true,
      data: properties,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// Search properties
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const searchTerm = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!searchTerm) {
      return res.status(400).json({ success: false, error: 'Search term required' });
    }

    const { properties, total } = await PropertyService.searchProperties(searchTerm, page, limit);

    res.json({
      success: true,
      data: properties,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

// Get property by ID
router.get(
  '/:id',
  validateRequest(idParamSchema),
  asyncHandler(async (req, res) => {
    const property = await PropertyService.getPropertyById(req.params.id);

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    const images = await PropertyService.getPropertyImages(req.params.id);
    const documents = await PropertyService.getPropertyDocuments(req.params.id);

    res.json({
      success: true,
      data: { ...property, images, documents },
    });
  })
);

// Update property (landlord only)
router.put(
  '/:id',
  authenticate,
  authorize(['landlord']),
  validateRequest(updatePropertySchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const property = await PropertyService.updateProperty(req.params.id, req.user!.id, req.body);

    res.json({
      success: true,
      data: property,
      message: 'Property updated successfully',
    });
  })
);

// Delete property (landlord only)
router.delete(
  '/:id',
  authenticate,
  authorize(['landlord']),
  validateRequest(idParamSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    await PropertyService.deleteProperty(req.params.id, req.user!.id);

    res.json({
      success: true,
      message: 'Property deleted successfully',
    });
  })
);

// Upload property image
router.post(
  '/:id/images',
  authenticate,
  authorize(['landlord']),
  validateRequest(idParamSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { imageUrl, isPrimary } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ success: false, error: 'Image URL required' });
    }

    const image = await PropertyService.uploadImage(req.params.id, imageUrl, isPrimary);

    res.status(201).json({
      success: true,
      data: image,
      message: 'Image uploaded successfully',
    });
  })
);

// Get property images
router.get(
  '/:id/images',
  validateRequest(idParamSchema),
  asyncHandler(async (req, res) => {
    const images = await PropertyService.getPropertyImages(req.params.id);

    res.json({
      success: true,
      data: images,
    });
  })
);

// Upload property document
router.post(
  '/:id/documents',
  authenticate,
  authorize(['landlord']),
  validateRequest(idParamSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { documentName, documentUrl } = req.body;

    if (!documentName || !documentUrl) {
      return res.status(400).json({ success: false, error: 'Document name and URL required' });
    }

    const document = await PropertyService.uploadDocument(req.params.id, documentName, documentUrl);

    res.status(201).json({
      success: true,
      data: document,
      message: 'Document uploaded successfully',
    });
  })
);

// Get property documents
router.get(
  '/:id/documents',
  validateRequest(idParamSchema),
  asyncHandler(async (req, res) => {
    const documents = await PropertyService.getPropertyDocuments(req.params.id);

    res.json({
      success: true,
      data: documents,
    });
  })
);

export default router;
