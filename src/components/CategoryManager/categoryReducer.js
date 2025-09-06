// Action Types
export const ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_CATEGORIES: 'SET_CATEGORIES',
  SET_FORM_MODE: 'SET_FORM_MODE',
  SET_EDITING_CATEGORY: 'SET_EDITING_CATEGORY',
  SET_DELETION_MODAL: 'SET_DELETION_MODAL',
  RESET_FORM: 'RESET_FORM',
  // Optimistic update actions
  ADD_CATEGORY_OPTIMISTIC: 'ADD_CATEGORY_OPTIMISTIC',
  CONFIRM_CATEGORY_ADD: 'CONFIRM_CATEGORY_ADD',
  REVERT_CATEGORY_ADD: 'REVERT_CATEGORY_ADD',
  UPDATE_CATEGORY_OPTIMISTIC: 'UPDATE_CATEGORY_OPTIMISTIC',
  CONFIRM_CATEGORY_UPDATE: 'CONFIRM_CATEGORY_UPDATE',
  REVERT_CATEGORY_UPDATE: 'REVERT_CATEGORY_UPDATE',
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
    affectedItems: { fixedExpenses: [], pendingTransactions: [] },
  },
};

// Reducer
export const categoryReducer = (state, action) => {
  switch (action.type) {
  case ACTIONS.SET_LOADING:
    return {
      ...state,
      isLoading: action.payload,
    };

  case ACTIONS.SET_CATEGORIES:
    return {
      ...state,
      categories: action.payload,
    };

  case ACTIONS.SET_FORM_MODE:
    return {
      ...state,
      formMode: action.payload,
      // Reset editing category if form mode is 'add' or null
      editingCategory: action.payload === 'edit' ? state.editingCategory : null,
    };

  case ACTIONS.SET_EDITING_CATEGORY:
    return {
      ...state,
      editingCategory: action.payload,
      formMode: action.payload ? 'edit' : null,
    };

  case ACTIONS.SET_DELETION_MODAL:
    return {
      ...state,
      deletionModal: {
        ...state.deletionModal,
        ...action.payload,
      },
    };

  case ACTIONS.RESET_FORM:
    return {
      ...state,
      formMode: null,
      editingCategory: null,
    };

  // Optimistic update cases
  case ACTIONS.ADD_CATEGORY_OPTIMISTIC:
    return {
      ...state,
      categories: [...state.categories, action.payload],
    };

  case ACTIONS.CONFIRM_CATEGORY_ADD:
    return {
      ...state,
      categories: state.categories.map(cat => 
        cat.id === action.payload.id ? action.payload : cat
      ),
    };

  case ACTIONS.REVERT_CATEGORY_ADD:
    return {
      ...state,
      categories: state.categories.filter(cat => cat.id !== action.payload),
    };

  case ACTIONS.UPDATE_CATEGORY_OPTIMISTIC:
    return {
      ...state,
      categories: state.categories.map(cat => 
        cat.id === action.payload.id 
          ? { ...cat, ...action.payload.updates }
          : cat
      ),
    };

  case ACTIONS.CONFIRM_CATEGORY_UPDATE:
    return {
      ...state,
      categories: state.categories.map(cat => 
        cat.id === action.payload.id 
          ? { ...cat, ...action.payload.updates }
          : cat
      ),
    };

  case ACTIONS.REVERT_CATEGORY_UPDATE:
    return {
      ...state,
      categories: state.categories.map(cat => 
        cat.id === action.payload.id 
          ? action.payload.originalData
          : cat
      ),
    };

  default:
    return state;
  }
};
