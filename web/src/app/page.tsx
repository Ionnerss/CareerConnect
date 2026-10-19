import { ArrowDown } from "lucide-react";
import HomeNavigation from "@/components/home/home-navigation";
import styles from "@/components/home/home.module.css";
import JobSeekerSection from "@/components/home/job-seeker-section";
import RecruiterSection from "@/components/home/recruiter-section";
import { HomeEnding, HomeFooter } from "@/components/home/home-ending";

const exampleJobs = [
  {
    initial: "N",
    title: "Frontend Developer",
    company: "Northline Studio",
    location: "Montréal · Hybrid",
  },
  {
    initial: "F",
    title: "Software Developer",
    company: "Fieldwork Labs",
    location: "Remote",
  },
];

export default function Home() {
  return (
    <div className={styles.home}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>

      <HomeNavigation />

      <main id="main-content" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="hero-heading">
          <div className={styles.heroCopy}>
            <h1 id="hero-heading" className={styles.headline}>
              Your talent.
              <br />
              <span>New possibilities.</span>
            </h1>

            <p className={styles.description}>
              Showcase your skills, explore opportunities, and keep your next
              move organized. Hiring? Get to know the people behind the
              applications.
            </p>

            <div className={styles.actions}>
              <a href="#job-seekers" className={styles.primaryAction}>
                Find opportunities
                <ArrowDown size={18} aria-hidden="true" />
              </a>

              <a href="#recruiters" className={styles.secondaryAction}>
                Find talent
                <ArrowDown size={18} aria-hidden="true" />
              </a>
            </div>

            <p className={styles.actionHint}>
              Explore what CareerConnect can do for you.
            </p>
          </div>

          <figure className={styles.showcase}>
            <article
              className={styles.profileCard}
              aria-labelledby="example-profile-name"
            >
              <div className={styles.person}>
                <div className={styles.avatar} aria-hidden="true">
                  AL
                </div>

                <div>
                  <h2
                    id="example-profile-name"
                    className={styles.profileName}
                  >
                    Alex Laurent
                  </h2>
                  <p className={styles.profileRole}>
                    Software developer · Montréal
                  </p>
                </div>
              </div>

              <ul className={styles.skills} aria-label="Example skills">
                {["TypeScript", "React", "Java"].map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>

              <div className={styles.project}>
                <p className={styles.eyebrow}>Featured project</p>
                <h3 className={styles.projectName}>
                  Community garden planner
                </h3>
                <p className={styles.projectDescription}>
                  A shared space to plan planting schedules and coordinate
                  volunteers.
                </p>
              </div>
            </article>

            <div className={styles.connector} aria-hidden="true" />

            <ul
              className={styles.opportunities}
              aria-label="Illustrative opportunities"
            >
              {exampleJobs.map((job) => (
                <li key={job.company}>
                  <article className={styles.jobCard}>
                    <div className={styles.companyMark} aria-hidden="true">
                      {job.initial}
                    </div>

                    <div>
                      <h3 className={styles.jobTitle}>{job.title}</h3>
                      <p className={styles.jobDetails}>
                        {job.company} · {job.location}
                      </p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>

            <figcaption className={styles.exampleLabel}>
              Illustrative profile and opportunities
            </figcaption>
          </figure>
        </section>

        <JobSeekerSection />
        <RecruiterSection />
        <HomeEnding />
      </main>
      <HomeFooter />
    </div>
  );
}