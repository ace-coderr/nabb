import { useQuery } from "@tanstack/react-query";
import { loadMetadata, type DropMetadata } from "../lib/metadata";

export function useMetadata(uri: string | undefined, dropId: bigint | undefined) {
  const fallbackName = dropId !== undefined ? `Drop #${dropId}` : "Drop";
  return useQuery<DropMetadata>({
    queryKey: ["metadata", uri],
    queryFn: () => loadMetadata(uri!, fallbackName),
    enabled: uri !== undefined,
    staleTime: Infinity,
    placeholderData: { name: fallbackName },
  });
}
