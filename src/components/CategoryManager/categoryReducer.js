// Action Types
export const ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_CATEGORIES: 'SET_CATEGORIES',
  SET_FORM_MODE: 'SET_FORM_MODE',
  SET_EDITING_CATEGORY: 'SET_EDITING_CATEGORY',
  SET_DELETION_MODAL: 'SET_DELETION_MODAL',
  RESET_FORM: 'RESET_FORM'
};

// Initial State
export const initialState = {
  categories: [],
  isLoading: true,
  formMode: null, // null, 'add', or 'edit'
  editingCategory: null,
  deletionModal: {
    isOpen: false,
    category: null,
    affectedItems: { fixedExpenses: [], pendingTransactions: [] }
  }
};

// Reducer
export const categoryReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
      };

    case ACTIONS.SET_CATEGORIES:
      return {
        ...state,
        categories: action.payload
      };

    case ACTIONS.SET_FORM_MODE:
      return {
        ...state,
        formMode: action.payload,
        // Reset editing category if form mode is 'add' or null
        editingCategory: action.payload === 'edit' ? state.editingCategory : null
      };

    case ACTIONS.SET_EDITING_CATEGORY:
      return {
        ...state,
        editingCategory: action.payload,
        formMode: action.payload ? 'edit' : null
      };

    case ACTIONS.SET_DELETION_MODAL:
      return {
        ...state,
        deletionModal: {
          ...state.deletionModal,
          ...action.payload
        }
      };

    case ACTIONS.RESET_FORM:
      return {
        ...state,
        formMode: null,
        editingCategory: null
      };

    default:
      return state;
  }
};
