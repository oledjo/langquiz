import { createHash } from 'node:crypto'

export interface AnkiRemainingCard {
  cardId: string | number
  note: string | number
  deckName: string
  modelName: string
  ord: number
  queue?: number
  fields: Record<string, { value: string; order?: number }>
}
export interface RemainingMedia { kind: 'image'; url: string; alt: string }
export interface RemainingExercise {
  id: string; type: 'selection'; topic: 'general'; subtopic: string; language: string
  prompt: string; options: string[]; answer: number; difficulty: 1 | 2 | 3 | 4 | 5; explanation: string
  isUserAdded: true; shareStatus: 'private'; tags: string[]
  media?: RemainingMedia; mediaGallery?: RemainingMedia[]
}
export interface RemainingSource { ankiCardId: string; ankiNoteId: string; deck: string; model: string }
export type RemainingCandidate = { source: RemainingSource; variantKey: string } & (
  { status: 'ready'; exercise: RemainingExercise; deckSlug: string } |
  { status: 'needs_review'; reason: string }
)
const DECKS = {
  'Great Works of Art': { slug: 'anki-art-titles', name: 'Great Works of Art' },
  'Great Works of Art::Artists': { slug: 'anki-art-artists', name: 'Great Works of Art::Artists' },
  'Породы::Cat Breeds': { slug: 'anki-cat-breeds', name: 'Породы::Cat Breeds' },
  'Породы::Dog Breeds': { slug: 'anki-dog-breeds', name: 'Породы::Dog Breeds' },
}
function decode(s: string): string {
  const entities: Record<string,string> = { amp:'&',quot:'"',apos:"'",nbsp:' ',lt:'<',gt:'>' }
  return s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(whole,e:string)=> {
    if(e[0]!=='#') return entities[e.toLowerCase()]??whole
    const n=e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):parseInt(e.slice(1),10)
    return n>=0&&n<=0x10ffff?String.fromCodePoint(n):whole
  })
}
function plain(s: string): string { return decode(s.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim() }
function lines(s: string): string[] { return s.split(/<br\s*\/?\s*>|<\/(?:div|p)>|\n/gi).map(plain).filter(Boolean) }
function key(s: string): string { return s.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'') }
function imageNames(s: string): string[] {
  return [...new Set(Array.from(s.matchAll(/<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi),m=>decode(m[1]??m[2]??m[3])))]
}
function hash(s:string):string { return createHash('sha256').update(s).digest('hex') }
interface Parsed { source: RemainingSource; variantKey: string; answer: string; aliases: string[]; domain: string; language: string; prompt: string; images: string[]; explanation: string; deckSlug: string }
function parse(c: AnkiRemainingCard): Parsed | RemainingCandidate {
  const source={ankiCardId:String(c.cardId),ankiNoteId:String(c.note),deck:c.deckName,model:c.modelName}
  const review=(reason:string):RemainingCandidate=>({source,variantKey:'review',status:'needs_review',reason})
  if(c.queue !== undefined && c.queue < 0)return review(c.queue === -1 ? 'Source card is suspended' : 'Source card is buried')
  const deck=DECKS[c.deckName as keyof typeof DECKS]
  if(!deck)return review('Deck requires editorial review')
  const f=(name:string)=>c.fields[name]?.value??''
  let variantKey:string, answer:string, aliases:string[]=[],domain:string,images:string[],prompt:string
  if(c.modelName==='Art-a7e12' && (c.ord===0||c.ord===1)) {
    variantKey=c.ord===0?'artist':'title';domain=`art-${variantKey}`
    if((c.ord===0)!==(c.deckName==='Great Works of Art::Artists'))return review('Art template does not match destination deck')
    answer=plain(f(c.ord===0?'Artist':'Title'));images=imageNames(f('Artwork'))
    if(c.ord===1) aliases=[...lines(f('Subtitle/Alternate Titles')),...lines(f('Title in Original Language'))]
    prompt=c.ord===0?'Who created this artwork?':'What is the title of this artwork?'
  } else if(c.modelName==='Cat Breeds'&&c.deckName==='Породы::Cat Breeds'&&c.ord===0){
    variantKey='breed';domain='cat-breed';aliases=lines(f('Breed'));answer=aliases[0]??'';images=imageNames(f('Image'));prompt='Which cat breed is shown?'
  } else if(c.modelName==='Basic-492c9'&&c.deckName==='Породы::Dog Breeds'&&c.ord===0){
    variantKey='breed';domain='dog-breed';answer=lines(f('Back'))[0]??'';images=imageNames(f('Front'));prompt='Which dog breed is shown?'
  } else return review('Unsupported model or template')
  const language=/[А-Яа-яЁё]/.test(answer)?'ru':'en'
  if(language==='ru')prompt=domain==='art-artist'?'Кто автор этого произведения?':domain==='art-title'?'Как называется это произведение?':domain==='cat-breed'?'Какая порода кошки на фотографии?':'Какая порода собаки на фотографии?'
  // Keep source metadata as labelled text, including URL attributes that would otherwise be lost.
  const explanation=Object.entries(c.fields).filter(([name])=>!['Artwork','Image','Front'].includes(name)).map(([name,field])=>{
    const urls=Array.from(field.value.matchAll(/href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi),m=>decode(m[1]??m[2]))
    return [name,[plain(field.value),...urls.filter(u=>!plain(field.value).includes(u))].filter(Boolean).join(' ')].join(': ')
  }).filter(s=>!s.endsWith(': ')).join('\n')
  return {source,variantKey,answer,aliases,domain,language,prompt,images,explanation,deckSlug:deck.slug}
}
export function analyzeRemaining(cards: AnkiRemainingCard[], mediaByFilename: Record<string,{url:string;alt?:string}>): {candidates:RemainingCandidate[];decks:{slug:string;name:string}[]} {
  const parsed=cards.map(parse)
  const valid=parsed.filter((p):p is Parsed=>!('status' in p)&&Boolean(p.answer))
  const candidates=parsed.map((p):RemainingCandidate=>{
    if('status'in p)return p
    const base={source:p.source,variantKey:p.variantKey}
    const review=(reason:string):RemainingCandidate=>({...base,status:'needs_review',reason})
    if(!p.answer)return review('Answer is blank')
    if(!p.images.length)return review('No question image')
    if(p.images.some(n=>!mediaByFilename[n]?.url))return review('Question media is missing')
    const equivalents=(v:Parsed)=>new Set([v.answer,...v.aliases].map(key))
    const excluded=equivalents(p)
    const pool=valid.filter(v=>v.domain===p.domain&&v.language===p.language).sort((a,b)=>a.answer.localeCompare(b.answer))
    const distractors:string[]=[]
    for(const v of pool.sort((a,b)=>hash(p.source.ankiCardId+a.answer).localeCompare(hash(p.source.ankiCardId+b.answer)))){
      const aliasKeys=equivalents(v)
      if([...aliasKeys].some(k=>excluded.has(k)))continue
      distractors.push(v.answer);for(const k of aliasKeys)excluded.add(k)
      if(distractors.length===3)break
    }
    if(distractors.length<3)return review('Fewer than four distinct same-domain answers')
    const options=[p.answer,...distractors].sort((a,b)=>hash(p.source.ankiCardId+p.variantKey+a).localeCompare(hash(p.source.ankiCardId+p.variantKey+b)))
    const mediaGallery=p.images.map((name,i):RemainingMedia=>({kind:'image',url:mediaByFilename[name].url,alt:p.language==='ru'?`Изображение ${i+1}`:`Image ${i+1}`}))
    return {...base,status:'ready',deckSlug:p.deckSlug,exercise:{id:`anki-${p.source.ankiCardId}-${p.variantKey}`,type:'selection',topic:'general',subtopic:p.domain,language:p.language,prompt:p.prompt,options,answer:options.indexOf(p.answer),difficulty:2,explanation:p.explanation,isUserAdded:true,shareStatus:'private',tags:['anki',p.domain],media:mediaGallery[0],mediaGallery}}
  })
  return {candidates,decks:Object.entries(DECKS).filter(([name])=>cards.some(c=>c.deckName===name)).map(([,deck])=>deck)}
}
