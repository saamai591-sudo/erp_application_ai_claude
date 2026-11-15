
-------------------------------------
CREATE   PROCEDURE [CFG].MonitoringActivity_PaymentCheqe

--WITH ENCRYPTION 
AS
BEGIN

    DECLARE @PaymentCheqesMaturity TINYINT,
            @User INT;

    SET @User = CFG.GetuserID();

    SELECT @PaymentCheqesMaturity = CAST(ConfigValue AS TINYINT)
    FROM CFG.Configuration f
    WHERE f.ConfigKey = 'PaymentCheqesMaturity';

	SELECT * INTO #vwBranchAccess
	FROM cfg.vwBranchAccess AS vba;

    SELECT ROW_NUMBER() OVER (ORDER BY pc.Number) AS RowID,
           pc.PaymentCheqeID,
           pc.Number,
           CFG.GetSaturnDate(pc.Date, 0) AS DateString,
           pc.Amount,
           d.Title AS BankAccountTitle,
           d.Title2 AS BankAccountTitle2,
           p.Title + ' ' + ISNULL(p.LastName, '') AS PartyTitle,
           p.Title2 + ' ' + ISNULL(p.LastName, '') AS PartyTitle2,
           b.Code BranchCode,
           b.Title BranchTitle,
           b.Title2 BranchTitle2,
           pct.Title CheqeType,
           pct.Title2 CheqeType2
    FROM FIN.PaymentCheqe pc
        JOIN FIN.PaymentReceipt pr
            ON pr.PaymentReceiptID = pc.PaymentReceiptID
        JOIN CFG.Party p
            ON p.PartyID = pr.PartyID
        JOIN CFG.BankAccount ba
            ON pc.BankAccountID = ba.BankAccountID
        JOIN ACC.DL d
            ON d.DLID = ba.DlID
        JOIN CFG.Branch b
            ON b.BranchID = pr.BranchID
        JOIN FIN.PaymentCheqeType pct
            ON pct.PaymentCheqeTypeID = pc.PaymentCheqeTypeID
        INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = pr.BranchID
    WHERE DATEDIFF(DAY, GETDATE(), pc.Date) <= @PaymentCheqesMaturity
          AND pc.LastState = 1
          AND pr.[Status]<>2
		  AND pct.Today = 0
END;
