import React from "react";
import Image from "next/image";
import { ArrowUpRight, Sparkles } from "lucide-react";

const IDEAS = [
  {
    title: "Find a different perspective",
    category: "Photography & light",
    image: "/create/coastal-light.webp",
    prompt: "An editorial photograph of a solitary windswept pine on a sculptural rock ledge above a still turquoise Mediterranean cove, distant mountains disappearing into dawn mist, warm sunlight on pine needles, deep jade water, natural textures, subtle film grain, wide composition",
  },
  {
    title: "Make the everyday extraordinary",
    category: "Product & still life",
    image: "/create/amber-still-life.webp",
    prompt: "An unbranded translucent amber perfume bottle with a brushed champagne-metal cap on a peach travertine plinth, curved frosted glass behind it, warm sunlight making beautiful caustics, tactile stone, refined editorial product photography, no text or logos",
  },
  {
    title: "Build another world",
    category: "Worldbuilding & detail",
    image: "/astra/scenes/spaceport_hub.png",
    prompt: "A sleek futuristic racing vehicle inside an illuminated space-station hangar, cool blue energy lighting, reflective metal, dramatic low perspective, detailed cinematic concept art",
  },
];

export function CreateInspiration({ onChoose, disabled }: { onChoose: (prompt: string) => void; disabled?: boolean }) {
  return (
    <section className="studio-inspiration" aria-labelledby="inspiration-title">
      <div className="studio-section-heading">
        <div>
          <span className="studio-eyebrow"><Sparkles size={13} aria-hidden="true" /> A little inspiration</span>
          <h2 id="inspiration-title">Where will you go?</h2>
        </div>
        <span className="studio-art-credit">Prompt inspiration</span>
      </div>
      <div className="studio-ideas">
        {IDEAS.map((idea, index) => (
          <button className={`studio-idea studio-idea-${index}`} key={idea.title} type="button" disabled={disabled} onClick={() => onChoose(idea.prompt)} aria-label={`Use prompt: ${idea.title}`}>
            <Image src={idea.image} alt="" fill sizes={index === 0 ? "(max-width: 760px) 90vw, (max-width: 1100px) 45vw, 768px" : "(max-width: 760px) 44vw, (max-width: 1100px) 22vw, 377px"} priority={index === 0} />
            <span className="studio-idea-copy"><span>{idea.category}</span><strong>{idea.title}</strong></span>
            <span className="studio-idea-action"><ArrowUpRight size={18} aria-hidden="true" /><span>Use prompt</span></span>
          </button>
        ))}
      </div>
      <p className="studio-inspiration-note">AI-made inspiration. Choose a starting point and make it your own. Results vary by model.</p>
    </section>
  );
}
