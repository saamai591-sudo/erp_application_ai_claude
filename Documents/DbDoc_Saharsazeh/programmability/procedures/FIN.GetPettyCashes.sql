--------------------------------------modify [FIN].GetPettyCashes----------------------------------------
Create   PROCEDURE FIN.GetPettyCashes
--WITH ENCRYPTION 
AS
BEGIN
	DECLARE @Culture VARCHAR(25),
			@CultureNo TINYINT;

	SET @Culture = CFG.GetuserCulture();

	SELECT @CultureNo = CultureNo
	FROM CFG.CultureInfo
	WHERE Culture = @Culture;

	SELECT p.PartyID,
		   d.DLID,
		   d.DlTypeID,
		   d.Code PartyCode,
		   CASE
			   WHEN p.Type = 1
					OR p.Type = 2 THEN
				   p.Title
			   ELSE
				   p.Title + ' ' + p.LastName
		   END AS PartyName,
		   CASE
			   WHEN p.Type = 1
					OR p.Type = 2 THEN
				   p.Title2
			   ELSE
				   p.Title2 + ' ' + p.LastName2
		   END AS PartyName2
	INTO #parties
	FROM CFG.Party p
		LEFT JOIN ACC.DL d
			ON p.DlID = d.DLID;
	select * into #vwPettyCashAccess
	from cfg.vwPettyCashAccess

	select * into #PettyCash_LastAmount
	from FIN.PettyCash_LastAmount
	SELECT *,
		   src.Title + ' ' +src.PartyName AS FullTitle
	from (
	SELECT p.PettyCashID,
		   p.HasBankPettyCash, 
		   pa.DLID,
		   d.Code AS DlCode,
		   f.DlID AS FundDLID,
		   CASE
			   WHEN @CultureNo = 2 THEN
				   f.Title2
			   ELSE
				   f.Title
		   END AS Title,
		   p.PartyID,
		   pa.PartyCode,
		   CASE
			   WHEN @CultureNo = 2 THEN
				   pa.PartyName2
			   ELSE
				   pa.PartyName
		   END AS PartyName,
		   p.CurrencyID,
		   CASE
			   WHEN @CultureNo = 2 THEN
				   c.Title2
			   ELSE
				   c.Title
		   END AS CurrencyName,
		   p.CurrencyRate,
		  pl.LastAmount LastAmount,
		   d.DlTypeID AS DlTypeID,
		   pa.DlTypeID AS PartyDlTypeID
	FROM FIN.PettyCash p
		JOIN #vwPettyCashAccess AS vpca
			ON vpca.PettyCashID = p.PettyCashID
		JOIN FIN.Fund AS f
			ON f.FundID = p.FundID
		JOIN ACC.DL d
			ON d.DLID = f.DlID
		JOIN #parties pa
			ON p.PartyID = pa.PartyID
		JOIN CFG.Currency c
			ON p.CurrencyID = c.CurrencyID
		JOIN #PettyCash_LastAmount pl
			ON p.PettyCashID = pl.PettyCashID
	WHERE p.IsActive = 1 
	) as src

END;
