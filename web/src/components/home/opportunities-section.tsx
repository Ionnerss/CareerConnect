import styles from "./home.module.css";
import { Reveal } from "./home-motion";

/**
 * Job presentation, in the spirit of a scannable list: title first, then
 * company and where/how, then the skills the posting asks for. These
 * postings are fictional. The fields mirror what a CareerConnect posting
 * actually has (title, company, location, work mode, experience, skills).
 */
const illustrativeJobs = [
  {
    initial: "N",
    tone: styles.tone0,
    title: "Frontend Developer",
    company: "Northline Studio",
    meta: ["Montréal", "Hybrid"],
    experience: "2+ years experience",
    skills: ["React", "TypeScript", "Git"],
  },
  {
    initial: "F",
    tone: styles.tone1,
    title: "Software Developer",
    company: "Fieldwork Labs",
    meta: ["Remote"],
    experience: "3+ years experience",
    skills: ["Java", "SQL", "Testing"],
  },
  {
    initial: "M",
    tone: styles.tone2,
    title: "Junior Web Developer",
    company: "Mapleworks Studio",
    meta: ["Ottawa", "On-site"],
    experience: "Entry level",
    skills: ["HTML", "CSS", "JavaScript"],
  },
  {
    initial: "H",
    tone: styles.tone3,
    title: "QA Analyst",
    company: "Harbour Systems",
    meta: ["Toronto", "Hybrid"],
    experience: "1+ years experience",
    skills: ["Testing", "SQL", "Git"],
  },
];

export default function OpportunitiesSection() {
  return (
    <section
      className={styles.opportunitiesSection}
      aria-labelledby="opportunities-heading"
    >
      <div className={styles.opportunitiesInner}>
        <Reveal>
          <div className={styles.opportunitiesIntro}>
            <div>
              <p className={styles.sectionLabel}>Opportunities</p>
              <h2 id="opportunities-heading" className={styles.sectionHeading}>
                Postings built to scan.
                <br />
                <span>See what each role asks for.</span>
              </h2>
            </div>

            <p className={styles.illustrativeTag}>
              Illustrative · not real jobs
            </p>
          </div>
        </Reveal>

        <ul className={styles.jobList} aria-label="Illustrative job postings">
          {illustrativeJobs.map((job, index) => (
            <li key={job.title}>
              <Reveal delay={index * 70}>
                <article className={styles.jobRow}>
                  <div
                    className={`${styles.companyMark} ${job.tone}`}
                    aria-hidden="true"
                  >
                    {job.initial}
                  </div>

                  <div>
                    <h3 className={styles.jobRowTitle}>{job.title}</h3>
                    <p className={styles.jobRowMeta}>
                      {[job.company, ...job.meta].map((part, partIndex) => (
                        <span key={part}>
                          {partIndex > 0 ? " · " : null}
                          <span className={styles.nowrap}>{part}</span>
                        </span>
                      ))}
                    </p>
                    <p className={styles.jobRowExperience}>{job.experience}</p>
                  </div>

                  <ul className={styles.jobSkills} aria-label="Skills wanted">
                    {job.skills.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>

        <p className={styles.listCaption}>
          Fictional postings, shown only to illustrate how a posting reads.
          Search real jobs after you create an account.
        </p>
      </div>
    </section>
  );
}
