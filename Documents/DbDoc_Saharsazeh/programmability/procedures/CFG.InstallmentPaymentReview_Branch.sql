


CREATE PROCEDURE [CFG].[InstallmentPaymentReview_Branch]
(
    @Installment            VARCHAR(MAX) = NULL,
    @InstallmentItem        VARCHAR(MAX) = NULL,
    @InstallmentPayItem     VARCHAR(MAX) = NULL
)
AS
	DECLARE @Culture       VARCHAR(25),
	        @CultureNo     TINYINT
	
	SET @Culture = CFG.GetuserCulture() 
	
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture
	
	SELECT b.BranchID,
	       b.Code                 AS BranchCode,
	       CASE 
	            WHEN @CultureNo = 1 THEN b.Title
	            WHEN @CultureNo = 2 THEN b.Title2
	       END                    AS BranchTitle
	FROM   (
	           SELECT ip.BranchID
	           FROM   cfg.InstallmentPayment AS ip
	                  
	           WHERE  (
	                      @Installment IS NULL
	                      OR ip.InstallmentPaymentID IN (SELECT VALUE
	                                                     FROM   cfg.R_FnCommaStr2Table(@Installment) AS rfcst)
	                  )
	                  AND (
	                          @InstallmentItem IS NULL
	                          OR EXISTS (
	                                 SELECT 1
	                                 FROM   cfg.InstallmentPaymentItem AS ipi
	                                        INNER JOIN cfg.R_FnCommaStr2Table(@InstallmentItem) AS rfcst
	                                             ON  ipi.InstallmentPaymentItemID = rfcst.[value]
	                                 WHERE  ipi.InstallmentPaymentID = ip.InstallmentPaymentID
	                             )
	                      )
	                  AND (
	                          @InstallmentPayItem IS NULL
	                          OR EXISTS 
	                             (
	                                 SELECT 1
	                                 FROM   cfg.InstallmentPaymentItem AS ipi
	                                        INNER JOIN FIN.PaymentSubject AS ps
	                                             ON  ps.InstallmentPaymentItemID = ipi.InstallmentPaymentItemID
	                                        INNER JOIN cfg.R_FnCommaStr2Table(@InstallmentPayItem) AS rfcst
	                                             ON  (3 * 1000000) + (ps.PaymentSubjectID) = rfcst.[value]
	                                 WHERE  ipi.InstallmentPaymentID = ip.InstallmentPaymentID
	                             )
	                          OR EXISTS 
	                             (
	                                 SELECT 1
	                                 FROM   cfg.InstallmentPaymentItem AS ipi
	                                        INNER JOIN FIN.ReceiveSubject AS rs
	                                             ON  rs.InstallmentPaymentItemID = ipi.InstallmentPaymentItemID
	                                        INNER JOIN cfg.R_FnCommaStr2Table(@InstallmentPayItem) AS rfcst
	                                             ON  (2 * 1000000) + rs.ReceiveSubjectID = rfcst.[value]
	                                 WHERE  ipi.InstallmentPaymentID = ip.InstallmentPaymentID
	                             )
	                          OR EXISTS 
	                             (
	                                 SELECT 1
	                                 FROM   cfg.InstallmentPaymentItem AS ipi
	                                        INNER JOIN cfg.ManualReceipt AS mr
	                                             ON  mr.InstallmentPaymentItemID = ipi.InstallmentPaymentItemID
	                                        INNER JOIN cfg.R_FnCommaStr2Table(@InstallmentPayItem) AS rfcst
	                                             ON  (4 * 1000000) + mr.ManualReceiptID = rfcst.[value]
	                                 WHERE  ipi.InstallmentPaymentID = ip.InstallmentPaymentID
	                             )
	                      )
	           GROUP BY
	                  ip.BranchID
	       ) T
	       INNER JOIN CFG.Branch  AS b
	            ON  b.BranchID = t.BranchID        
	
