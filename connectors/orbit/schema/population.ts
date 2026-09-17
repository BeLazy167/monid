import { z } from "zod";

/**
 * The population fragments — shared by `orbit#v3/search/populations` and its
 * free quote. Faithful mirrors of the published v3 components (design D25):
 * optionality only, with `profile_depth`'s vendor default applied at each
 * binding.
 */
export const zPopulationSubject = z.object({
    kind: z.enum(["company", "school"]).describe(
        "What the population is: a company's current employees, or a " +
            "school's alumni.",
    ),
    id: z.string().describe("The numeric id of the company or school."),
    name: z.string().min(1).max(200).describe("The company or school name."),
});

export const populationShape = {
    population: zPopulationSubject,
    size: z.number().int().min(0).nullable().optional().describe(
        "How many people the population has, when you know it.",
    ),
    profile_depth: z.enum(["partial", "full"]).optional().describe(
        "The depth every person in the population is built to.",
    ),
} as const;
