/* Empty-record factories for the registration guidelines editor. */

export const emptyPerson = () => ({ name: "", role: "", email: "", phone: "" });
export const emptyMentor = () => ({ name: "", role: "", email: "" });
export const emptyAdvisor = () => ({
  name: "",
  email: "",
  assignment: { lastNameFrom: "", lastNameTo: "", track: "" },
});
export const emptyLabContact = () => ({ name: "", role: "", email: "", howToContact: "" });
export const emptyRule = () => ({ code: "", text: "" });
export const emptyLink = () => ({ label: "", url: "" });
