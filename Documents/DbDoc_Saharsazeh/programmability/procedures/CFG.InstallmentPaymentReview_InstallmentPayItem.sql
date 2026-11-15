
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.1.261
 * Time: 6/28/2017 4:13:44 PM
 ************************************************************/

CREATE   PROCEDURE [CFG].[InstallmentPaymentReview_InstallmentPayItem]
(
    @Branch              VARCHAR(MAX) = NULL,
    @Installment         VARCHAR(MAX) = NULL,
    @InstallmentItem     VARCHAR(MAX) = NULL
	
)
AS
	DECLARE @UserID         INT,
	        @DateType       TINYINT,
	        @DateFormat     VARCHAR(10),
	        @Culture        VARCHAR(10)
	
	SET @UserID = CFG.GetuserID()
	SET @Culture = cfg.GetuserCulture()
	
	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE @Culture
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END
	
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID
	
	IF @DateFormat IS NULL
	    SET @DATEFORMAT = 'YY/MM/DD' 
	
	SELECT ipi0.InstallmentPaymentItemID,
	       ip.Number,
	       ipi0.Number AS ItemNumber
	INTO   #T
	FROM   cfg.InstallmentPayment AS ip
	       INNER JOIN CFG.InstallmentPaymentItem AS ipi0
	            ON  ipi0.InstallmentPaymentID = ip.InstallmentPaymentID
		   join   cfg.vwInstallmentPaymentRemain as remain 
								on ipi0.InstallmentPaymentItemID = remain.InstallmentPaymentItemID
	WHERE  (
	           @Branch IS NULL
	           OR ip.BranchID IN (SELECT VALUE
	                              FROM   cfg.R_FnCommaStr2Table(@Branch) AS rfcst)
	       )
	       AND (
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
	                      WHERE  ipi.InstallmentPaymentItemID = ipi0.InstallmentPaymentItemID
	                  )
	           )
						
						
						
	
	SELECT rr.ReceiveReceiptID            AS realId,
	       2                              AS ItemPayTypeId,
	       2 * 1000000 + rs.ReceiveSubjectID AS id,
		   rr.[Date] AS ItemPayDate,
	       cfg.GetCLRSaturnDate(rr.[Date], @DateFormat, 0, @DateType) AS Date_ItemPayDate,
	       rs.Amount                      AS ItemPayAmount,
	       N'دریافت'               AS ItemPayType,
	       t.Number,
	       t.ItemNumber
	FROM   fin.ReceiveSubject             AS rs
	       INNER JOIN FIN.ReceiveReceipt  AS rr
	            ON  rr.ReceiveReceiptID = rs.ReceiveReceiptID
	       INNER JOIN #T                  AS t
	            ON  rs.InstallmentPaymentItemID = t.InstallmentPaymentItemID
	UNION
	SELECT pr.PaymentReceiptID            AS realId,
	       3                              AS ItemPayTypeId,
	       3 * 1000000 + rs.PaymentSubjectID AS id,
		   pr.[Date] AS ItemPayDate,
	       cfg.GetCLRSaturnDate(pr.[Date], @DateFormat, 0, @DateType) AS Date_ItemPayDate,
	       rs.Amount                      AS ItemPayAmount,
	       N'پرداخت'               AS ItemPayType,
	       t.Number,
	       t.ItemNumber
	FROM   fin.PaymentSubject             AS rs
	       INNER JOIN FIN.PaymentReceipt  AS pr
	            ON  pr.PaymentReceiptID = rs.PaymentReceiptID
	       INNER JOIN #T                  AS t
	            ON  rs.InstallmentPaymentItemID = t.InstallmentPaymentItemID
	UNION
	SELECT mr.ManualReceiptID           AS realId,
	       4                              AS ItemPayTypeId,
	       4 * 1000000 + mr.ManualReceiptID  AS id,
		   mr.[Date] AS ItemPayDate,
	       cfg.GetCLRSaturnDate(mr.[Date], @DateFormat, 0, @DateType) AS Date_ItemPayDate,
	       mr.Amount                      AS ItemPayAmount,
	       N'تسویه دستی '               AS ItemPayType,
	       t.Number,
	       t.ItemNumber
	FROM cfg.ManualReceipt AS mr
	       INNER JOIN #T                  AS t
	            ON  mr.InstallmentPaymentItemID = t.InstallmentPaymentItemID
	    
