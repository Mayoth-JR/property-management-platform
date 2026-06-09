// src/components/common/Pagination.tsx
import React from 'react';
import './Pagination.css';
import { Button } from './Button';

interface PaginationProps {
  page: number;
  pages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  pages,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
}) => {
  return (
    <div className="pagination">
      <Button
        size="small"
        disabled={!hasPreviousPage}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>
      <span className="pagination-info">
        Page {page} of {pages}
      </span>
      <Button
        size="small"
        disabled={!hasNextPage}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
};
