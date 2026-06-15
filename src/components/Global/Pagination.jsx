import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";

export default function Pagination({ currentPage, pageCount, onPageChange }) {
  const handlePaginationClick = (pageNumber) => {
    if (pageNumber >= 0 && pageNumber < pageCount) {
      onPageChange(pageNumber);
    }
  };

  let pageIndex = [];
  if (pageCount <= 4) {
    pageIndex = Array.from({ length: pageCount }, (_, idx) => idx + 1);
  } else if (currentPage < 2) {
    pageIndex = [1, 2, 3, pageCount];
  } else if (currentPage >= pageCount - 2) {
    pageIndex = [1, pageCount - 2, pageCount - 1, pageCount];
  } else {
    pageIndex = [1, currentPage + 1, currentPage + 2, pageCount];
  }

  return (
    <section className="flex items-center justify-center gap-3 md:gap-5 py-8 md:py-12">
      <button
        onClick={() => handlePaginationClick(currentPage - 1)}
        disabled={currentPage === 0}
        className="p-2 text-header hover:text-header-hover disabled:text-gray-400 transition-colors"
        aria-label="Previous page"
      >
        <FontAwesomeIcon icon={faChevronLeft} />
      </button>
      {pageIndex.map((pageNumber, index) => (
        <button
          key={index}
          onClick={() => handlePaginationClick(pageNumber - 1)}
          className={`${
            pageNumber - 1 === currentPage
              ? "bg-header text-white shadow-md"
              : "bg-header/10 text-header font-semibold hover:bg-header/20"
          } px-4 md:px-5 py-2 rounded-md transition-all`}
        >
          {pageNumber}
        </button>
      ))}
      <button
        onClick={() => handlePaginationClick(currentPage + 1)}
        disabled={currentPage === pageCount - 1}
        className="p-2 text-header hover:text-header-hover disabled:text-gray-400 transition-colors"
        aria-label="Next page"
      >
        <FontAwesomeIcon className="transform rotate-180" icon={faChevronLeft} />
      </button>
    </section>
  );
}
