
CREATE   PROCEDURE [FOS].[spGetCreditAllocationItemBaseDocuments]
(
@LetterCreditID int,
@Date DATE
)
--WITH ENCRYPTION 
AS
BEGIN

	DECLARE @UserID INT,
			@DateType TINYINT,
			@DateFormat VARCHAR(10),
			@PurchaseInvoice         NVARCHAR(100),
			@ConfirmStatement        NVARCHAR(100),
			@ConfirmStatementItem    NVARCHAR(100),			
			@ContractStatement       NVARCHAR(100),
			@Number NVARCHAR(25),
			@Culture NVARCHAR(100),
			@CultureNo tinyint,
			@ConfirmPurchaseInvoice NVARCHAR(50),
			@ConfirmPurchaseInvoiceItem NVARCHAR(50),
			@Branch INT;
		
	SET @UserID = CFG.GetuserID()
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture   
	
	select @Branch = BranchID
	from FOS.LetterCredit 
	where LetterCreditID = @LetterCreditID    
	
	SELECT  @DateType = us.SettingValue
	FROM    CFG.UserSetting us
	WHERE   us.SettingKey = 'Date_Type'
			AND us.UserID = @UserID
	
	IF @DateType IS NULL
		SET @DateType = CASE CFG.GetuserCulture()
							WHEN 'fa' THEN 0
							WHEN 'en' THEN 1
							WHEN 'ar' THEN 2
						END
	
	SELECT  @DateFormat = us.SettingValue
	FROM    CFG.UserSetting us
	WHERE   us.SettingKey = 'Date_Format'
			AND us.UserID = @UserID
	
	IF @DateFormat IS NULL
		SET @DateFormat = 'YY/MM/DD'

	SELECT @PurchaseInvoice = lev.[Value]
	FROM   cfg.LocalizeEnum le
		   JOIN cfg.LocalizeEnumValue lev
				ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'BaseDocuments'
		   AND le.Item = 'PurchaseInvoice'
		   AND lev.Culture = cfg.GetuserCulture()
		   
	SELECT @ConfirmStatement = lev.[Value]
	FROM   cfg.LocalizeEnum le
		   JOIN cfg.LocalizeEnumValue lev
				ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'BaseDocuments'
		   AND le.Item = 'ConfirmStatement'
		   AND lev.Culture = cfg.GetuserCulture()
		
	SELECT @ConfirmStatementItem = lev.[Value]
	FROM   cfg.LocalizeEnum le
		   JOIN cfg.LocalizeEnumValue lev
				ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'PurchaseDocumentBases'
		   AND le.Item = 'ContractStatement'
		   AND lev.Culture = cfg.GetuserCulture()

	SELECT @ContractStatement = lev.[Value]
	FROM   cfg.LocalizeEnum le
		   JOIN cfg.LocalizeEnumValue lev
				ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'BaseDocuments'
		   AND le.Item = 'ContractStatement'
		   AND lev.Culture = cfg.GetuserCulture()

	SELECT @Number = lev.[Value]
	FROM   cfg.LocalizeEnum le
		   JOIN cfg.LocalizeEnumValue lev
				ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'GeneralEnum'
		   AND le.Item = 'Number'
		   AND lev.Culture = cfg.GetuserCulture()

	SELECT @ConfirmPurchaseInvoice = lev.[Value]
	FROM   cfg.LocalizeEnum le
		   JOIN cfg.LocalizeEnumValue lev
				ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'BaseDocuments'
		   AND le.Item = 'ConfirmPurchaseInvoice'
		   AND lev.Culture = @Culture

	SELECT @ConfirmPurchaseInvoiceItem = lev.[Value]
	FROM   cfg.LocalizeEnum le
		   JOIN cfg.LocalizeEnumValue lev
				ON  lev.LocalizeEnumID = le.LocalizeEnumID
	WHERE  le.Enum = 'BaseDocuments'
		   AND le.Item = 'ConfirmPurchaseInvoiceItem'
		   AND lev.Culture = @Culture


	 SELECT 'pi_' + CAST(p.PurchaseInvoiceID AS NVARCHAR(100)) DocumentID,
			'PurchaseInvoice' DocumentType,
			 @PurchaseInvoice DocumentName,
			 ISNULL(p.InvoiceNumber, CAST(p.Number AS NVARCHAR(100))) Number,
			 CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) Date,
			 p.CurrencyID,
			 case @CultureNo
				when 1 then c.Title
				when 2 then c.Title2
			 end as CurrencyName, 
			 pa.NonPaymented Remain
	FROM VND.PurchaseInvoice p
	JOIN CFG.Currency c ON p.CurrencyID = c.CurrencyID
	JOIN VND.PurchaseInvoice_NonPaymented pa ON p.PurchaseInvoiceID = pa.PurchaseInvoiceID
	JOIN (select i.PurchaseInvoiceID, l.LetterCreditID
		  from VND.PurchaseInvoiceItem i 
		  JOIN FOS.ProformaInvoiceItem i2 ON i.ProformaInvoiceItemID = i2.ProformaInvoiceItemID
		  JOIN FOS.LetterCredit l ON i2.ProformaInvoiceID = l.ProformaInvoiceID
		 ) item ON item.PurchaseInvoiceID = p.PurchaseInvoiceID
		 JOIN VND.PurchaseType pt ON p.Type = pt.PurchaseTypeID
		LEFT JOIN VND.ConfirmPurchaseInvoice cc ON p.PurchaseInvoiceID = cc.PurchaseInvoiceID
	WHERE p.[Date] <= @Date
		  AND pa.NonPaymented > 0
		  AND p.BaseType = 9
		  AND item.LetterCreditID = @LetterCreditID
		  AND pt.HasConfirmStatement = 0 

	UNION ALL

	
	 SELECT 'pi_' + CAST(p.PurchaseInvoiceID AS NVARCHAR(100)) DocumentID,
			'PurchaseInvoice' DocumentType,
			 @PurchaseInvoice DocumentName,
			 ISNULL(p.InvoiceNumber, CAST(p.Number AS NVARCHAR(100))) Number,
			 CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) Date,
			 p.CurrencyID,
			 case @CultureNo
				when 1 then c.Title
				when 2 then c.Title2
			 end as CurrencyName, 
			 pii.Tax + pii.Duty Remain
	FROM VND.PurchaseInvoice p
	JOIN VND.PurchaseInvoiceItem pii ON p.PurchaseInvoiceID = pii.PurchaseInvoiceID
	JOIN CFG.Currency c ON p.CurrencyID = c.CurrencyID
	LEFT JOIN VND.PurchaseInvoice_NonPaymented pa ON p.PurchaseInvoiceID = pa.PurchaseInvoiceID
	JOIN (select i.PurchaseInvoiceID, l.LetterCreditID
		  from VND.PurchaseInvoiceItem i 
		  JOIN FOS.ProformaInvoiceItem i2 ON i.ProformaInvoiceItemID = i2.ProformaInvoiceItemID
		  JOIN FOS.LetterCredit l ON i2.ProformaInvoiceID = l.ProformaInvoiceID
		 ) item ON item.PurchaseInvoiceID = p.PurchaseInvoiceID
		 JOIN VND.PurchaseType pt ON p.Type = pt.PurchaseTypeID
		 JOIN VND.ConfirmPurchaseInvoice cc ON p.PurchaseInvoiceID = cc.PurchaseInvoiceID
	WHERE p.[Date] <= @Date
		  AND pa.NonPaymented > 0
		  AND p.BaseType = 9
		  AND item.LetterCreditID = @LetterCreditID
		  AND pt.HasConfirmStatement = 1

		   UNION ALL

 
	 
	 SELECT 'cn_' + CAST(cpi.ConfirmPurchaseInvoiceID AS NVARCHAR(100)) DocumentId,
			'ConfirmPurchaseInvoice' DocumentType,
			 @ConfirmPurchaseInvoice DocumentName,
			 ISNULL(p.InvoiceNumber, CAST(p.Number AS NVARCHAR(100))) Number,
			 CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) Date,
			 p.CurrencyID,
			 case 1
				when 1 then c.Title
				when 2 then c.Title2
			 end as CurrencyName, 
				CASE 
					WHEN cpi.PurchaseInvoiceID IS NOT NULL 
						then  v.NonPayment
							ELSE NULL
			   END Remain
	FROM VND.ConfirmPurchaseInvoice cpi
		JOIN VND.PurchaseInvoice p
			ON  cpi.PurchaseInvoiceID = p.PurchaseInvoiceID
		JOIN CFG.Currency c 
			ON p.CurrencyID = c.CurrencyID
		JOIN VND.VWConfirmPurchaseInvoiceNonePayment v 
			ON cpi.ConfirmPurchaseInvoiceID = v.ConfirmPurchaseInvoiceID
		JOIN (
			SELECT DISTINCT a.ConfirmPurchaseInvoiceID, l.LetterCreditID
			FROM VND.ConfirmPurchaseInvoice a
				JOIN VND.PurchaseInvoiceItem i 
					ON a.PurchaseInvoiceID = i.PurchaseInvoiceID
				JOIN FOS.ProformaInvoiceItem i2 
					ON i.ProformaInvoiceItemID = i2.ProformaInvoiceItemID
				JOIN FOS.LetterCredit l 
					ON i2.ProformaInvoiceID = l.ProformaInvoiceID
		) item 
			ON item.ConfirmPurchaseInvoiceID = cpi.ConfirmPurchaseInvoiceID
	WHERE p.[Date] <= @Date
		  AND v.NonPayment > 0
		  AND p.BaseType = 9 --proforma base PurchaseInvoice
		  AND item.LetterCreditID = @LetterCreditID
	UNION ALL

 
	 
	 SELECT 'ci_' + CAST(cpii.ConfirmPurchaseInvoiceItemID AS NVARCHAR(100)) DocumentId,
			'ConfirmPurchaseInvoiceItem' DocumentType,
			 @ConfirmPurchaseInvoiceItem DocumentName,
			 ISNULL(p.InvoiceNumber, CAST(p.Number AS NVARCHAR(100))) Number,
			 CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) Date,
			 p.CurrencyID,
			 case 1
				when 1 then c.Title
				when 2 then c.Title2
			 end as CurrencyName, 
				CASE 
					WHEN cpi.PurchaseInvoiceID IS NOT NULL 
						then  v.NonPayment
							ELSE NULL
			   END Remain
	FROM  VND.ConfirmPurchaseInvoiceItem cpii
		JOIN VND.ConfirmPurchaseInvoice cpi
			ON cpii.ConfirmPurchaseInvoiceID = cpi.ConfirmPurchaseInvoiceID
		JOIN VND.PurchaseInvoice p
			ON  cpi.PurchaseInvoiceID = p.PurchaseInvoiceID
		JOIN CFG.Currency c 
			ON p.CurrencyID = c.CurrencyID
		JOIN VND.VWConfirmPurchaseInvoiceNonePayment v 
			ON cpi.ConfirmPurchaseInvoiceID = v.ConfirmPurchaseInvoiceID	
		JOIN (
			SELECT DISTINCT a.ConfirmPurchaseInvoiceID, l.LetterCreditID
			FROM VND.ConfirmPurchaseInvoice a
				JOIN VND.PurchaseInvoiceItem i 
					ON a.PurchaseInvoiceID = i.PurchaseInvoiceID
				JOIN FOS.ProformaInvoiceItem i2 
					ON i.ProformaInvoiceItemID = i2.ProformaInvoiceItemID
				JOIN FOS.LetterCredit l 
					ON i2.ProformaInvoiceID = l.ProformaInvoiceID
		) item 
		ON item.ConfirmPurchaseInvoiceID = cpi.ConfirmPurchaseInvoiceID
	WHERE p.[Date] <= @Date
		  AND v.NonPayment > 0
		  AND p.BranchID =@Branch
		  AND p.BaseType = 9 --proforma base PurchaseInvoice
		  AND item.LetterCreditID = @LetterCreditID


		  UNION
	SELECT 'cs_' + CAST(cs.ConfirmStatementID AS NVARCHAR(100)) DocumentID,
		   'ConfirmStatement' DocumentType,

			@ConfirmStatement + ' ' + @Number + ' ' +
				cast(cst.Number as varchar(250)) DocumentName,
			c.Number,
			CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) Date,
			cst.CurrencyID,
			case @CultureNo
				when 1 then cu.Title
				when 2 then cu.Title2
			 end as CurrencyName,
			vw.Remain		
	FROM CNT.ConfirmStatement cs
	JOIN  CNT.[Contract] c ON cs.ContractID = c.ContractID
	JOIN  CNT.ContractStatement cst ON cst.ContractStatementID = cs.ContractStatementID
	JOIN CFG.Currency cu ON cst.CurrencyID = cu.CurrencyID
	JOIN (select l.LetterCreditID, p.Vendor 
		  from FOS.LetterCredit l
		  JOIN FOS.ProformaInvoice p ON l.ProformaInvoiceID = p.ProformaInvoiceID
		  ) le ON cst.PartyID = le.Vendor
	JOIN CNT.vwConfirmStatementRemain vw ON vw.ConfirmStatementID = cs.ConfirmStatementID		   
	WHERE c.[Date] <= @Date
		  AND vw.Remain > 0
		  AND le.LetterCreditID = @LetterCreditID

	UNION
		
	SELECT 'si_' + CAST(csi.ConfirmStatementItemID AS NVARCHAR(100)) DocumentID,
		   'ConfirmStatementItem' DocumentType,
			case @CultureNo
				when 1 then adt.Title
				when 2 then adt.Title2
			 end + ' ' + @ConfirmStatementItem + ' ' + @Number + ' ' +
				cast(cst.Number as varchar(250)) DocumentName,
			c.Number,
			CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) Date,
			cst.CurrencyID,
			case @CultureNo
				when 1 then cu.Title
				when 2 then cu.Title2
			 end as CurrencyName,
			vw.Remain 
	FROM CNT.ConfirmStatementItem csi
	JOIN cnt.AdditionDeductionType adt ON adt.AdditionDeductionTypeID = csi.AdditionDeductionTypeID
	JOIN CNT.ConfirmStatement cs ON csi.ConfirmStatementID = cs.ConfirmStatementID
	JOIN CNT.ContractStatement cst ON cst.ContractStatementID = cs.ContractStatementID
	JOIN CNT.[Contract] c ON cs.ContractID = c.ContractID
	JOIN CFG.Currency cu ON cst.CurrencyID = cu.CurrencyID
	JOIN (select l.LetterCreditID, p.Vendor 
		  from FOS.LetterCredit l
		  JOIN FOS.ProformaInvoice p ON l.ProformaInvoiceID = p.ProformaInvoiceID
		  ) le ON cst.PartyID = le.Vendor	
	JOIN CNT.vwConfirmStatementItemRemain vw ON vw.ConfirmStatementItemID = csi.ConfirmStatementItemID	   
	WHERE c.[Date] <= @Date
		  AND adt.Payable = 1
		  AND csi.Deduction > 0
		  AND vw.Remain > 0
		  AND le.LetterCreditID = @LetterCreditID

	UNION 
		
	SELECT 'co_' + CAST(cs.ContractStatementID AS NVARCHAR(100)) DocumentID,
		   'ContractStatement' DocumentType,
			@ContractStatement + ' ' + @Number + ' ' +
			 cast(cs.Number as varchar(250)) DocumentName,
			c.Number,
			CFG.GetCLRSaturnDate(c.[Date], @DateFormat, 0, @DateType) Date,
			cs.CurrencyID,
			case @CultureNo
				when 1 then cu.Title
				when 2 then cu.Title2
			 end as CurrencyName,
			vw.VatRemain as Remain
	FROM CNT.ContractStatement cs
	JOIN CNT.[Contract] c ON cs.ContractID = c.ContractID
	JOIN CFG.Currency cu ON cs.CurrencyID = cu.CurrencyID
	JOIN (select l.LetterCreditID, p.Vendor 
		  from FOS.LetterCredit l
		  JOIN FOS.ProformaInvoice p ON l.ProformaInvoiceID = p.ProformaInvoiceID
		  ) le ON cs.PartyID = le.Vendor	
	JOIN CNT.vwContractStatementRemain vw ON vw.ContractStatementID = cs.ContractStatementID	   
	WHERE c.[Date] <= @Date
		  AND vw.VatRemain > 0
		  AND le.LetterCreditID = @LetterCreditID

END

