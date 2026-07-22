export interface TechnicalOpinionListItem {
  id: string;
  number: string;
  classificationLabel: string;
  issuedAt: string;
  assessmentVersion: {
    assessment: { id: string; softwareName: string; vendor: string };
  };
  issuedBy: { id: string; name: string; email: string };
}

export interface PaginatedTechnicalOpinions {
  items: TechnicalOpinionListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TechnicalOpinionFilters {
  assessmentId?: string;
  issuedById?: string;
  classificationLabel?: string;
  number?: string;
  from?: string;
  to?: string;
}
