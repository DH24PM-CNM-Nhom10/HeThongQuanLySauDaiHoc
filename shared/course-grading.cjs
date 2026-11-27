function savedScores(book) {
  return Array.isArray(book?.scores)
    ? book.scores
    : Array.isArray(book?.publishedScores)
      ? book.publishedScores
      : [];
}
function coursePolicy(store, code) {
  const course = (store.courses || []).find(
    (c) => c.code === String(code).toUpperCase(),
  );
  const scale =
    course &&
    (store.academicPolicies || []).find((p) => p.id === course.policyId);
  return course && scale
    ? {
        ...scale,
        id: course.code + ":" + course.revision,
        scaleId: scale.id,
        courseCode: course.code,
        gpaWeight: course.gpaWeight,
        credits: course.credits,
        processWeight: course.processWeight,
        examWeight: course.examWeight,
        description:
          course.name +
          " — quá trình " +
          course.processWeight * 100 +
          "%, thi " +
          course.examWeight * 100 +
          "%",
      }
    : null;
}
module.exports = { savedScores, coursePolicy };
