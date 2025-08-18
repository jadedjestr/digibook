import React from 'react';
import { toast } from 'react-toastify';
import { logger } from './logger';

export const notify = {
  success: (message) => {
    logger.success(message);
    toast.success(message);
  },
  
  error: (message, error) => {
    logger.error(message, error);
    toast.error(message);
  },
  
  warning: (message) => {
    logger.warn(message);
    toast.warning(message);
  },
  
  info: (message) => {
    logger.info(message);
    toast.info(message);
  }
};

export const showConfirmation = (message) => {
  return new Promise((resolve) => {
    toast.info(
      <div>
        <p>{message}</p>
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={() => {
              toast.dismiss();
              resolve(true);
            }}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Yes
          </button>
          <button
            onClick={() => {
              toast.dismiss();
              resolve(false);
            }}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            No
          </button>
        </div>
      </div>,
      {
        autoClose: false,
        closeOnClick: false,
        draggable: false,
        closeButton: false
      }
    );
  });
};
