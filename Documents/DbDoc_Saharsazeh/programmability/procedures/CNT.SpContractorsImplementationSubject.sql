CREATE PROC CNT.SpContractorsImplementationSubject
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
           CASE
               WHEN @CultureNo = 1 THEN
                   cs.Description
               ELSE
                   cs.Description2
           END ContractSubject,
           CASE
               WHEN @CultureNo = 1 THEN
                   cu.Title
               ELSE
                   cu.Title2
           END Currency,
           cs.Price,
           ACC.SlFullCode(cs.SlID) SlCode,
           CASE
               WHEN @CultureNo = 1 THEN
                   s.Title
               ELSE
                   s.Title2
           END SlTitle
    FROM CNT.ContractSubject cs
    JOIN CNT.Contract c
        ON c.ContractID = cs.ContractID
    JOIN  #vwBranchAccess Branch on Branch.BranchID = C.BranchID
    JOIN CFG.Currency cu
        ON cu.CurrencyID = cs.CurrencyID
    JOIN ACC.SL s
        ON s.SlID = cs.SlID
    WHERE cs.StuffID IS NULL
          AND
          (
              @SelectedContracts IS NULL
              OR EXISTS
    (
        SELECT value
        FROM CFG.R_FnCommaStr2Table(@SelectedContracts)
        WHERE value = cs.ContractID
    )
          )
          AND c.CompanyRoll = 1;
END;
