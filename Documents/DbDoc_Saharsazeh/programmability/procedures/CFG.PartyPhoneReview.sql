CREATE   PROCEDURE [CFG].[PartyPhoneReview]
(@SelectedParties VARCHAR(MAX) = NULL)
AS
	DECLARE @Culture       VARCHAR(10),
	        @CultureNo     TINYINT,
	        @UserID        INT
	
	SET @Culture = CFG.GetuserCulture() 
	SET @UserID = cfg.GetuserID()
	
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture
	
	SELECT VALUE AS PartyID
	INTO   #SelectedParties
	FROM   CFG.R_FnCommaStr2Table(@SelectedParties)	
	
	SELECT CASE 
	            WHEN @CultureNo = 1 THEN at.title
	            WHEN @CultureNo = 2 THEN at.title2
	       END                   AS PhoneType,
	       a.PhoneID,
	       a.Phone,
	       a.IsMain,
	       a.PartyID,
	       CASE 
	            WHEN @CultureNo = 1 THEN p.Title
	            WHEN @CultureNo = 2 THEN p.Title2
	       END                   AS Title,
	       CASE 
	            WHEN @CultureNo = 1 THEN p.LastName
	            WHEN @CultureNo = 2 THEN p.LastName2
	       END                   AS LastName,
	       d.Code                AS DlCode
	FROM   cfg.Phone             AS a
	       INNER JOIN CFG.Party  AS p
	            ON  p.PartyID = a.PartyID
	       INNER JOIN ACC.DL     AS d
	            ON  d.DLID = p.DlID
	       INNER JOIN cfg.AddressType at
	            ON  at.AddressTypeID = a.AddressTypeID
	       LEFT JOIN #SelectedParties sp
	            ON  p.PartyID = sp.PartyID
	            INNER JOIN cfg.vwPartyAccess AS vpa ON vpa.PartyID = p.PartyID
	WHERE  (@SelectedParties IS NULL OR sp.PartyID IS NOT NULL)
