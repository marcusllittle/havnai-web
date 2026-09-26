import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Film, ImageIcon, Sparkles } from "lucide-react";
import { SeoHead } from "./SeoHead";
import { SiteHeader } from "./SiteHeader";

type Kind = "image" | "video";
const directions = {
  landscape: "An editorial photograph of a windswept pine above a quiet turquoise Mediterranean cove, distant mountains in dawn mist, warm sunlight, natural stone textures, subtle film grain, wide composition",
  product: "An unbranded amber glass perfume bottle on a pale travertine plinth, soft curved frosted glass behind it, warm sunlight and caustics, tactile stone, refined editorial product photography, no text or logos",
  world: "A sleek futuristic racing vehicle inside an illuminated space-station hangar, cool blue energy lighting, reflective metal, dramatic low perspective, detailed cinematic concept art",
  coastalMotion: "A slow, gentle push toward a windswept pine above a quiet turquoise cove. Small ripples move across the water, warm dawn light remains steady, the rock ledge and distant mountains stay consistent.",
  spaceMotion: "A slow tracking shot across a futuristic flight deck overlooking a nebula. Distant lights shimmer gently while the architecture remains stable, cinematic lighting and restrained camera movement.",
};
const createHref = (kind: Kind, prompt?: string) => `/create?mode=${kind}${prompt ? `&prompt=${encodeURIComponent(prompt)}` : ""}`;

const content = {
  image: {
    title: "Make the image you can almost see.",
    description: "Start with a scene, a mood, or a small detail. Choose an available model and give your idea its first form.",
    action: "Create an image", art: "/create/coastal-light.webp", alt: "AI-made concept of a windswept pine above a turquoise coastal cove", artTitle: "A quieter kind of landscape", artPrompt: directions.landscape,
    eyebrow: "AI image generation", seo: "AI image generation for ideas, scenes, and new worlds",
    stepTitle: "From a few words to a new direction.",
    steps: [
      { title: "Describe the scene", body: "Start with your subject, then add the light, setting, and details that matter." },
      { title: "Shape the result", body: "Choose an available image model. Open settings for size, references, and more control." },
      { title: "Make it your own", body: "Review your result, adjust the prompt, and find your saved jobs in Collection." },
    ],
    ideas: [
      { title: "Find beauty in the everyday", label: "Product & still life", art: "/create/amber-still-life.webp", alt: "Illustrative amber glass bottle on pale stone", prompt: directions.product },
      { title: "Build a world worth exploring", label: "Worldbuilding & concept art", art: "/astra/scenes/spaceport_hub.png", alt: "Concept artwork of a futuristic vehicle in a blue-lit hangar", prompt: directions.world },
    ],
    faqs: [
      { question: "Can I use a reference image?", answer: "Open Model, size & reference in Create to add an image reference. Available controls depend on the model you choose." },
      { question: "Do I need to connect a wallet?", answer: "You can explore Create without connecting. Before generation, Create shows the session, credit, and model availability requirements for that deployment." },
      { question: "Where can I find my results?", answer: "Open Collection to review your image and video jobs. Download the results you want to keep." },
      { question: "How much does generation cost?", answer: "Current generation costs and available funding options are listed on the credits and pricing page. Availability may change during Public Alpha." },
    ],
  },
  video: {
    title: "Give your idea a sense of motion.",
    description: "Set the scene. Describe what moves. Choose an available video model and add a starting frame when it needs one.",
    action: "Create a video", art: "/astra/scenes/nebula_runway_briefing.png", alt: "Astra concept artwork of a futuristic flight deck overlooking a nebula", artTitle: "Imagine the next few seconds", artPrompt: directions.spaceMotion,
    eyebrow: "AI video generation", seo: "AI video generation for scenes and motion concepts",
    stepTitle: "Direct a moment, one choice at a time.",
    steps: [
      { title: "Choose your starting point", body: "Select a video model in Create. Add a starting image when the selected workflow requires it." },
      { title: "Describe the movement", body: "Give the subject or camera a clear action. Keep the setting and lighting specific." },
      { title: "Review and refine", body: "Generate when capacity is available, review the clip, and adjust your direction for the next run." },
    ],
    ideas: [
      { title: "Let the landscape breathe", label: "Gentle camera motion", art: "/create/coastal-light.webp", alt: "Landscape concept for a quiet coastal camera move", prompt: directions.coastalMotion },
      { title: "Find a new perspective", label: "Cinematic worldbuilding", art: "/astra/scenes/spaceport_hub.png", alt: "Futuristic vehicle and hangar concept for a cinematic camera move", prompt: "A slow lateral camera move past a sleek futuristic vehicle in a blue-lit hangar. Reflections shift gently across the bodywork. Keep the vehicle shape and hangar structure consistent, with restrained cinematic movement." },
    ],
    faqs: [
      { question: "Can I generate a video from text alone?", answer: "That depends on the available model and workflow. Some workflows require a starting image; Create shows that requirement before you can submit." },
      { question: "What should I put in a motion prompt?", answer: "Describe the subject and scene, then one clear action or camera move. Add lighting and atmosphere, and say what should remain consistent." },
      { question: "How is Video Studio different?", answer: "Video Studio is a separate workspace for source-image video workflows and requires a studio key. The main Create workspace uses the session and capacity shown there." },
      { question: "Why might generation be unavailable?", answer: "Video needs a compatible model and available GPU capacity. Create shows availability, required inputs, and any account requirements before you submit." },
    ],
  },
};

export function GenerationLanding({ kind }: { kind: Kind }) {
  const page = content[kind];
  const Icon = kind === "image" ? ImageIcon : Film;
  const path = `/ai-${kind}-generator`;
  const schema = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: `HavnAI ${kind === "image" ? "Image" : "Video"} Generator`, url: `https://joinhavn.io${path}`, applicationCategory: "MultimediaApplication", operatingSystem: "Web", description: page.description, publisher: { "@type": "Organization", name: "HavnAI", url: "https://joinhavn.io" } };
  return <>
    <SeoHead title={page.seo} description={page.description} path={path} image={page.art} imageAlt={page.alt} schema={schema} />
    <SiteHeader />
    <main className={`product-page product-${kind}`}>
      <section className="product-hero" aria-labelledby="product-title">
        <div className="product-hero-copy">
          <span className="product-eyebrow"><Icon size={15} aria-hidden="true" /> {page.eyebrow}</span>
          <h1 id="product-title">{page.title}</h1><p>{page.description}</p>
          <div className="product-actions"><Link className="product-primary" href={createHref(kind)}>{page.action} <ArrowUpRight size={17} aria-hidden="true" /></Link><Link className="product-secondary" href="/pricing">Credits & pricing</Link></div>
          <span className="product-availability">Public Alpha / models and capacity vary</span>
        </div>
        <figure className="product-hero-art">
          <div><Image src={page.art} alt={page.alt} fill sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 1328px) 53vw, 660px" priority /></div>
          <figcaption><span><small>{kind === "video" ? "Concept frame / not a generated clip" : "AI-made inspiration artwork"}</small><strong>{page.artTitle}</strong></span><Link href={createHref(kind, page.artPrompt)} aria-label={`Use prompt: ${page.artTitle}`}><ArrowUpRight size={20} aria-hidden="true" /></Link></figcaption>
        </figure>
      </section>
      <section className="product-process" aria-labelledby="process-title"><div className="product-section-heading"><span className="product-eyebrow">The creative process</span><h2 id="process-title">{page.stepTitle}</h2></div><ol>{page.steps.map((step, index) => <li key={step.title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol></section>
      <section className="product-inspiration" aria-labelledby="directions-title">
        <div className="product-section-heading"><span className="product-eyebrow"><Sparkles size={14} aria-hidden="true" /> A place to begin</span><h2 id="directions-title">Borrow a direction. Make it yours.</h2><p>These prompts open in Create, ready for you to edit.</p></div>
        <div className="product-ideas">{page.ideas.map(idea => <Link key={idea.title} className="product-idea" href={createHref(kind, idea.prompt)}><div className="product-idea-art"><Image src={idea.art} alt={idea.alt} fill sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 1328px) 47vw, 630px" /></div><div className="product-idea-copy"><span>{idea.label}</span><h3>{idea.title}</h3><p>{idea.prompt}</p><strong>Start with this prompt <ArrowRight size={16} aria-hidden="true" /></strong></div></Link>)}</div>
        <p className="product-caption">Illustrative AI artwork. Results vary by prompt, model, and available settings.{kind === "video" ? " These stills are scene inspiration, not example video outputs." : ""}</p>
      </section>
      {kind === "video" && <aside className="product-studio"><div><span className="product-eyebrow">Another way to work</span><h2>Have a studio key?</h2><p>Open the dedicated Video Studio to work from a source image.</p></div><Link className="product-secondary" href="/video-studio">Explore Video Studio <ArrowUpRight size={16} aria-hidden="true" /></Link></aside>}
      <section className="product-faq" aria-labelledby="questions-title"><div><span className="product-eyebrow">Good to know</span><h2 id="questions-title">Before your first generation.</h2><Link href="/how-it-works">See how HavnAI works <ArrowRight size={15} aria-hidden="true" /></Link></div><div>{page.faqs.map(faq => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section>
      <section className="product-outro"><div><span className="product-eyebrow">Your next idea</span><h2>{kind === "image" ? "See where a prompt takes you." : "Start with a single scene."}</h2></div><Link className="product-primary" href={createHref(kind)}>{page.action} <ArrowUpRight size={17} aria-hidden="true" /></Link></section>
    </main>
    <footer className="product-footer"><Link href="/">HavnAI home</Link><Link href={kind === "image" ? "/ai-video-generator" : "/ai-image-generator"}>{kind === "image" ? "Explore video generation" : "Explore image generation"}</Link><Link href="/library">Your collection</Link><Link href="/nodes">The GPU network</Link></footer>
  </>;
}
