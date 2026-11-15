------------------------------------- START #7579
CREATE    PROCEDURE [CFG].[PartyAccountReview]
(@SelectedParties VARCHAR(MAX) = NULL)
AS
BEGIN
	DECLARE @Culture       VARCHAR(10),
		        @CultureNo     TINYINT
		
	SET @Culture = CFG.GetuserCulture() 
		
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture
		
	SELECT VALUE AS PartyID
	INTO   #SelectedParties
	FROM   CFG.R_FnCommaStr2Table(@SelectedParties)	
		
	SELECT      		
				pa.PartyAccountID,
				CASE WHEN @CultureNo = 1 THEN p.Title + ' ' + ISNULL(p.LastName, '')
	                WHEN @CultureNo = 2 THEN p.Title2 + ' ' + ISNULL(p.LastName2, '')
	           END AS Party,
		       d.Code                AS DlCode,
			   pa.AccountNumber,
			   pa.CardNumber,
			   pa.IBAN,
			   CASE @CultureNo
					WHEN 1 THEN b.Title
					WHEN 2 THEN b.Title2
				END AS Bank	
		FROM CFG.PartyAccount pa
		join CFG.Party  AS p
			ON pa.PartyID = p.PartyID
	    join cfg.Bank b
			ON pa.BankID = b.BankID
		INNER JOIN ACC.DL     AS d
		    ON  d.DLID = p.DlID
		LEFT JOIN #SelectedParties sp
		     ON  p.PartyID = sp.PartyID
		INNER JOIN cfg.vwPartyAccess AS vpa 
			ON vpa.PartyID = p.PartyID
		WHERE  (@SelectedParties IS NULL OR sp.PartyID IS NOT NULL)
END
