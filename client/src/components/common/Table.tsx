// src/components/common/Table.tsx
import React from 'react';
import './Table.css';

interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
}

export const Table = <T extends Record<string, any>>({
  columns,
  data,
  loading,
  onRowClick,
}: TableProps<T>) => {
  return (
    <div className="table-wrapper">
      {loading ? (
        <div className="table-loading">Loading...</div>
      ) : data.length === 0 ? (
        <div className="table-empty">No data available</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={String(col.key)}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr
                key={idx}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'clickable' : ''}
              >
                {columns.map((col) => (
                  <td key={String(col.key)}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
