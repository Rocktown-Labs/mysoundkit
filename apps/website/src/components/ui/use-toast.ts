// Shared toast adapter — delegates to the single actor in @/hooks/use-toast so
// both import paths use the same ID generator and the same Sonner store.
export { reducer, toast, useToast } from "@/hooks/use-toast";
