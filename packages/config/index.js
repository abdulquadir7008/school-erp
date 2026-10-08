module.exports = {
  api: {
    prefix: "/api/v1",
    timeout: 30000,
  },
  pagination: {
    defaultLimit: 25,
    maxLimit: 100,
  },
  upload: {
    maxFileSize: 10 * 1024 * 1024,
    allowedTypes: ["image", "pdf", "doc", "xls", "csv"],
  },
  app: {
    name: "SchoolSphere ERP",
    version: "1.0.0",
  },
};