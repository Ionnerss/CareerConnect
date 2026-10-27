import styles from "./home.module.css";
import { Reveal } from "./home-motion";

/** Every step describes something CareerConnect does today. */
const steps = [
  {
    number: "01",
    title: "Build your profile",
    text: "Sign up and add your skills, education, experience and projects, then upload your résumés.",
  },
  {
    number: "02",
    title: "Search for jobs",
    text: "Search open jobs by keyword, company, skill or location, and read what each role asks for.",
  },
  {
    number: "03",
    title: "Follow every application",
    text: "See where each application stands in one place, from in progress to interview to a final decision.",
  },
];

export default function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className={styles.stepsSection}
      aria-labelledby="how-it-works-heading"
      tabIndex={-1}
    >
      <div className={styles.stepsInner}>
        <Reveal>
          <p className={styles.sectionLabel}>How it works</p>
          <h2 id="how-it-works-heading" className={styles.sectionHeading}>
            Three steps.
            <br />
            <span>One place for your search.</span>
          </h2>
        </Reveal>

        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li key={step.number}>
              <Reveal delay={index * 100}>
                <article className={styles.step}>
                  <p className={styles.stepNumber} aria-hidden="true">
                    {step.number}
                  </p>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepText}>{step.text}</p>
                </article>
              </Reveal>
            </li>
          ))}
        </ol>

        <Reveal delay={200}>
          <p className={styles.stepsNote}>
            <strong>Hiring?</strong> See who applied to each of your postings,
            with each applicant&rsquo;s skill match shown against what you
            asked for.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
