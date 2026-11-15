CREATE PROC CNT.SpEmployersProcurementSubject
(@SelectedContracts NVARCHAR(MAX) = NULL)
AS
BEGIN

    DECLARE @CultureNo VARCHAR(10),
            @Culture VARCHAR(10);

    SET @Culture = CFG.GetuserCulture();
    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

	SELECT * 
	INTO #vwBranchAccess 
	FROM cfg.vwBranchAccess 

    SELECT cs.ContractSubjectID,
           s.code StuffCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   s.Title
               ELSE
                   s.Title
           END StuffTitle,
           CASE
               WHEN @CultureNo = 1 THEN
                   cu.Title
               ELSE
                   cu.Title2
           END Currency,
           cs.Quantity,
           cs.Fee,
           cs.Price
    FROM CNT.ContractSubject cs
    JOIN CNT.Contract c
        ON c.ContractID = cs.ContractID
    JOIN  #vwBranchAccess Branch 
        on Branch.BranchID = C.BranchID
    JOIN STF.VWStuff s
        ON s.StuffID = cs.StuffID
    JOIN CFG.Currency cu
        ON cu.CurrencyID = cs.CurrencyID
    WHERE (
              @SelectedContracts IS NULL
              OR EXISTS
    (
        SELECT 1
        FROM CFG.R_FnCommaStr2Table(@SelectedContracts)
        WHERE [value] = cs.ContractID
    )
          )
          AND c.CompanyRoll = 2;
END;
