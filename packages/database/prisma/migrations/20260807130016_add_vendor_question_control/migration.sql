-- CreateTable
CREATE TABLE "vendor_question_controls" (
    "vendorQuestionId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,

    CONSTRAINT "vendor_question_controls_pkey" PRIMARY KEY ("vendorQuestionId","controlId")
);

-- AddForeignKey
ALTER TABLE "vendor_question_controls" ADD CONSTRAINT "vendor_question_controls_vendorQuestionId_fkey" FOREIGN KEY ("vendorQuestionId") REFERENCES "vendor_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_question_controls" ADD CONSTRAINT "vendor_question_controls_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
