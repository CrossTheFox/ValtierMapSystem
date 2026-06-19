/** Re-export desde módulos de tipos y dependencias (sin import circular). */
export {
    WIKI_ENTITY_CREATION_ORDER,
    WIKI_ENTITY_TYPE_OPTIONS,
    WIKI_ENTITY_TYPE_OPTIONS as WIKI_ENTITY_TYPE_OPTIONS_ORDERED,
} from "../wikiEntityTypes";

export { WIKI_CREATION_ORDER_STEPS, getWikiCreationOrderChain } from "./wikiEntityDependencies";
