-----------------Start of #9343


CREATE   PROCEDURE [FIN].SpRptFinance_ReceiveCommitment
--WITH ENCRYPTION      
AS
BEGIN

    DECLARE @Receive NVARCHAR(100),
            @DrawBack NVARCHAR(100),
            @Cheque NVARCHAR(100),
            @Promissory NVARCHAR(100),
            @Guaranty NVARCHAR(100),
            @InProgress NVARCHAR(100),
            @Revoke NVARCHAR(100),
            @CashFromBank NVARCHAR(100),
            @UserID INT,
            @Culture VARCHAR(25),
            @CultureNo TINYINT;

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

	
    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

	
    SELECT @Receive = lev.[Value]
    FROM CFG.LocalizeEnum le
         JOIN CFG.LocalizeEnumValue lev
             ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'ReceiveCheqeCommitmentState'
          AND le.Item = 'Receive'
          AND lev.Culture = @Culture


    SELECT @DrawBack = lev.[Value]
    FROM CFG.LocalizeEnum le
         JOIN CFG.LocalizeEnumValue lev
             ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'ReceiveCheqeCommitmentState'
          AND le.Item = 'DrawBacked'
          AND lev.Culture = @Culture

    SELECT @Cheque = lev.[Value]
    FROM CFG.LocalizeEnum le
         JOIN CFG.LocalizeEnumValue lev
             ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CommitmentDocumentsType'
          AND le.Item = 'Cheque'
          AND lev.Culture = @Culture


    SELECT @Promissory = lev.[Value]
    FROM CFG.LocalizeEnum le
         JOIN CFG.LocalizeEnumValue lev
             ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CommitmentDocumentsType'
          AND le.Item = 'Promissory'
          AND lev.Culture = @Culture


    SELECT @Guaranty = lev.[Value]
    FROM CFG.LocalizeEnum le
         JOIN CFG.LocalizeEnumValue lev
             ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'CommitmentDocumentsType'
          AND le.Item = 'Guaranty'
          AND lev.Culture = @Culture


    SELECT @InProgress = lev.[Value]
    FROM CFG.LocalizeEnum le
         JOIN CFG.LocalizeEnumValue lev
             ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'GuarantyState'
          AND le.Item = 'InProgress'
          AND lev.Culture = @Culture

    SELECT @Revoke = lev.[Value]
    FROM CFG.LocalizeEnum le
         JOIN CFG.LocalizeEnumValue lev
             ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'GuarantyState'
          AND le.Item = 'Revoke'
          AND lev.Culture = @Culture


    SELECT @CashFromBank = lev.[Value]
    FROM CFG.LocalizeEnum le
         JOIN CFG.LocalizeEnumValue lev
             ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'GuarantyState'
          AND le.Item = 'CashFromBank'
          AND lev.Culture = @Culture

    DECLARE @DateType TINYINT,
            @DateFormat VARCHAR(10);


    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                            WHEN 'fa' THEN 0
                            WHEN 'en' THEN 1
                            WHEN 'ar' THEN 2
                        END;


    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';


		SELECT * INTO #vwBranchAccess
        FROM cfg.vwBranchAccess AS vba	
	

    SELECT p.PartyID,
           d.Code PartyCode,
           CASE
               WHEN p.[Type] = 1 OR p.[Type] = 2 THEN p.Title
               WHEN p.[Type] = 0 THEN p.Title + ' ' + p.LastName
           END PartyTitle,
           CASE
               WHEN p.[Type] = 1 OR p.[Type] = 2 THEN p.Title2
               WHEN p.[Type] = 0 THEN p.Title2 + ' ' + p.LastName2
           END PartyTitle2
    INTO #Parties
    FROM CFG.Party p
         LEFT JOIN ACC.DL AS d
             ON p.DlID = d.DLID;


    SELECT DISTINCT ROW_NUMBER() OVER (ORDER BY Number) RowID,
           a.DocumentID,
           a.DocumentType,
           a.DocumentNumber,
           a.CurrencyID,
           a.CurrencyTitle,
           a.CurrencyRate,
           a.Amount,
           a.LastState,
           a.ReceiveCommitmentID,
           a.Number,
           a.ReceivedDate,
           a.Date_ReceivedDate,
           a.BranchID,
           a.BranchCode,
           a.BranchName,
           a.PartyID,
           a.PartyCode,
           a.PartyName,
           a.CashID,
           a.CashCode,
           a.CashName,
           a.ContractID,
           a.ContractDlCode,
           a.TenderID,
           a.TenderTitle,
           a.[Description],
		   a.DueDate,
		   CommitmentType,
		   a.BankTitle AS BankTitle,
		   a.BankBranch AS BankBranch,
		   a.BankBranchCode AS BankBranchCode
    FROM
    (
        SELECT rc.ReceiveCheqeCommitmentID DocumentID,
               @Cheque DocumentType,
               rc.Number DocumentNumber,
               rc.CurrencyID,
               CASE @CultureNo
                   WHEN 1 THEN cu.Title
                   WHEN 2 THEN cu.Title2
               END AS CurrencyTitle,
               rc.CurrencyRate CurrencyRate,
               rc.Amount,
               CASE rc.LastState
                   WHEN 0 THEN @Receive
                   WHEN 1 THEN @DrawBack
               END LastState,
               r.ReceiveCommitmentID,
               r.Number,
               r.[Date] AS ReceivedDate,
               CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) Date_ReceivedDate,
               r.BranchID,
               b.Code BranchCode,
               CASE @CultureNo
                   WHEN 1 THEN b.Title
                   WHEN 2 THEN b.Title2
               END AS BranchName,
               r.PartyID,
               p.PartyCode,
               CASE @CultureNo
                   WHEN 1 THEN p.PartyTitle
                   WHEN 2 THEN p.PartyTitle2
               END AS PartyName,
               r.CashID,
               dl.Code CashCode,
               CASE @CultureNo
                   WHEN 1 THEN c.Title
                   WHEN 2 THEN c.Title2
               END AS CashName,
               r.ContractID,
			   co.Number + ' - ' +
               CASE @CultureNo
                   WHEN 1 THEN co.Title
                   WHEN 2 THEN co.Title2
               END ContractDlCode,
               r.TenderID,
               CASE @CultureNo
                   WHEN 1 THEN t.Title
                   WHEN 2 THEN t.Title2
               END AS TenderTitle,
               CASE WHEN @CultureNo  = 1 then r.Description else r.Description2 END Description,
			   null DueDate,
               CASE @CultureNo
                   WHEN 1 THEN ct.Title
                   WHEN 2 THEN ct.Title2
               END AS CommitmentType,
			   NULL AS BankTitle,
			   NULL AS BankBranch,
			   NULL AS BankBranchCode
        FROM FIN.ReceiveCheqeCommitment AS rc
            JOIN FIN.ReceiveCommitment AS r
                ON rc.ReceiveCommitmentID = r.ReceiveCommitmentID
			JOIN fin.CommitmentType AS ct
				ON ct.CommitmentTypeID = rc.CommitmentTypeID
            JOIN CFG.Currency AS cu
                ON rc.CurrencyID = cu.CurrencyID
            JOIN CFG.Branch AS b
                ON r.BranchID = b.BranchID
            JOIN #Parties AS p
                ON r.PartyID = p.PartyID
            JOIN CFG.Cash AS c
                ON r.CashID = c.CashID
            JOIN ACC.DL AS dl
                ON c.DlID = dl.DLID
            LEFT JOIN VND.Tender AS t
                ON r.TenderID = t.TenderID
            LEFT JOIN CNT.[Contract] AS co
                ON r.ContractID = co.ContractID
            INNER JOIN #vwBranchAccess AS vba 
                ON vba.BranchID = r.BranchID
        UNION ALL
        SELECT rp.ReceivePromissoryCommitmentID DocumentID,
               @Promissory DocumentType,
               rp.Number DocumentNumber,
               rp.CurrencyID,
               CASE @CultureNo
                   WHEN 1 THEN cu.Title
                   WHEN 2 THEN cu.Title2
               END AS CurrencyTitle,
               rp.CurrencyRate CurrencyRate,
               rp.Amount,
               CASE rp.LastState
                   WHEN 0 THEN @Receive
                   WHEN 1 THEN @DrawBack
               END LastState,
               r.ReceiveCommitmentID,
               r.Number,
               r.[Date] AS ReceivedDate,
               CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) Date_ReceivedDate,
               r.BranchID,
               b.Code BranchCode,
               CASE @CultureNo
                   WHEN 1 THEN b.Title
                   WHEN 2 THEN b.Title2
               END AS BranchName,
               r.PartyID,
               p.PartyCode,
               CASE @CultureNo
                   WHEN 1 THEN p.PartyTitle
                   WHEN 2 THEN p.PartyTitle2
               END AS PartyName,
               r.CashID,
               dl.Code CashCode,
               CASE @CultureNo
                   WHEN 1 THEN c.Title
                   WHEN 2 THEN c.Title2
               END AS CashName,
               r.ContractID,
			   co.Number + ' - ' +
               CASE @CultureNo
                   WHEN 1 THEN co.Title
                   WHEN 2 THEN co.Title2
               END ContractDlCode,
               r.TenderID,
               CASE @CultureNo
                   WHEN 1 THEN t.Title
                   WHEN 2 THEN t.Title2
               END AS TenderTitle,
              CASE WHEN @Cultureno = 1 then  r.Description else r.Description2 End Description,
			   CFG.GetCLRSaturnDate(rp.[Date], @DateFormat, 0, @DateType) DueDate,
               CASE @CultureNo
                   WHEN 1 THEN ct.Title
                   WHEN 2 THEN ct.Title2
               END AS CommitmentType,
			   NULL AS BankTitle,
			   NULL AS BankBranch,
			   NULL AS BankBranchCode
        FROM FIN.ReceivePromissoryCommitment rp
            JOIN FIN.ReceiveCommitment AS r
                ON rp.ReceiveCommitmentID = r.ReceiveCommitmentID
			JOIN fin.CommitmentType AS ct
				on ct.CommitmentTypeID = rp.CommitmentTypeID
            JOIN CFG.Currency AS cu
                ON rp.CurrencyID = cu.CurrencyID
            JOIN CFG.Branch AS b
                ON r.BranchID = b.BranchID
            JOIN #Parties AS p
                ON r.PartyID = p.PartyID
            JOIN CFG.Cash AS c
                ON r.CashID = c.CashID
            JOIN ACC.DL AS dl
                ON c.DlID = dl.DLID
            LEFT JOIN VND.Tender AS t
                ON r.TenderID = t.TenderID
            LEFT JOIN CNT.[Contract] AS co
                ON r.ContractID = co.ContractID
            INNER JOIN #vwBranchAccess AS vba 
                ON vba.BranchID = r.BranchID
        UNION ALL
        SELECT rg.ReceiveGuarantyCommitmentID DocumentID,
               @Guaranty DocumentType,
               rg.Number DocumentNumber,
               rg.CurrencyID,
               CASE @CultureNo
                   WHEN 1 THEN cu.Title
                   WHEN 2 THEN cu.Title2
               END AS CurrencyTitle,
               rg.CurrencyRate CurrencyRate,
               CASE de.OperationType
                    WHEN 5 THEN rg.Amount  + isnull(de.DeductedAmount,0)
                    WHEN 2 THEN rg.Amount  - isnull(de.DeductedAmount,0)
                    ELSE rg.Amount
               END AS Amount,
               CASE rg.LastState
                   WHEN 1 THEN @InProgress
                   WHEN 2 THEN @Revoke
                   WHEN 3 THEN @CashFromBank
               END LastState,
               r.ReceiveCommitmentID,
               r.Number,
               r.[Date] AS ReceivedDate,
               CFG.GetCLRSaturnDate(r.[Date], @DateFormat, 0, @DateType) Date_ReceivedDate,
               r.BranchID,
               b.Code BranchCode,
               CASE @CultureNo
                   WHEN 1 THEN b.Title
                   WHEN 2 THEN b.Title2
               END AS BranchName,
               r.PartyID,
               p.PartyCode,
               CASE @CultureNo
                   WHEN 1 THEN p.PartyTitle
                   WHEN 2 THEN p.PartyTitle2
               END AS PartyName,
               r.CashID,
               dl.Code CashCode,
               CASE @CultureNo
                   WHEN 1 THEN c.Title
                   WHEN 2 THEN c.Title2
               END AS CashName,
               r.ContractID,
			   co.Number + ' - ' +
               CASE @CultureNo
                   WHEN 1 THEN co.Title
                   WHEN 2 THEN co.Title2
               END ContractDlCode,
               r.TenderID,
               CASE @CultureNo
                   WHEN 1 THEN t.Title
                   WHEN 2 THEN t.Title2
               END AS TenderTitle,
               CASE WHEN @CultureNo  = 1 then r.Description else r.Description2 END Description,
			   CFG.GetCLRSaturnDate(
                    CASE 
                        WHEN gop.DueDate IS NOT NULL THEN gop.DueDate 
                        ELSE rg.Date 
                    END,
                    @DateFormat,
                    0,
                    @DateType
               ) DueDate,
               CASE @CultureNo
                   WHEN 1 THEN ct.Title
                   WHEN 2 THEN ct.Title2
               END AS CommitmentType,
		  CASE 
		  WHEN @CultureNo = 2 THEN ba.Title2 ELSE ba.Title END AS BankTitle,
		  rg.BankBranchName  BankBranch,
		  rg.BankBranchCode AS BankBranchCode
        FROM FIN.ReceiveGuarantyCommitment rg
            JOIN FIN.ReceiveCommitment AS r
                ON rg.ReceiveCommitmentID = r.ReceiveCommitmentID
			JOIN fin.CommitmentType AS ct
				on ct.CommitmentTypeID = rg.CommitmentTypeID
            JOIN CFG.Currency AS cu
                ON rg.CurrencyID = cu.CurrencyID
            JOIN CFG.Branch AS b
                ON r.BranchID = b.BranchID
            JOIN #Parties AS p
                ON r.PartyID = p.PartyID
            JOIN CFG.Cash AS c
                ON r.CashID = c.CashID
            JOIN ACC.DL AS dl
                ON c.DlID = dl.DLID
            LEFT JOIN VND.Tender AS t
                ON r.TenderID = t.TenderID
            LEFT JOIN CNT.[Contract] AS co
                ON r.ContractID = co.ContractID
			LEFT JOIN CFG.Bank ba ON rg.BankID = ba.BankID
			left join
			(
			select ReceiveGuarantyCommitmentID,
                sum(DeductedAmount) DeductedAmount,
                OperationType
			from fin.GuarantyOperation
			where OperationType = 2 OR OperationType=5
			group by ReceiveGuarantyCommitmentID,OperationType
			)de on de.ReceiveGuarantyCommitmentID = rg.ReceiveGuarantyCommitmentID
		    LEFT JOIN
		    (
		    	SELECT 
		    	    ROW_NUMBER() over(partition by ReceiveGuarantyCommitmentID order by date desc) Rno,
		    	    ReceiveGuarantyCommitmentID,
		    	    DueDate
		    	FROM fin.GuarantyOperation
		    	WHERE OperationType = 1		
		    	AND ReceiveGuarantyCommitmentID IS NOT NULL
		    ) AS gop
			    ON gop.ReceiveGuarantyCommitmentID = rg.ReceiveGuarantyCommitmentID
			AND gop.Rno = 1
			INNER JOIN #vwBranchAccess AS vba 
                ON vba.BranchID = r.BranchID
    ) AS a

END;

----------------End of #9343

