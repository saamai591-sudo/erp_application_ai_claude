
CREATE   PROC [HRM].[spFoodTypeItemUpdate]
    @FoodTypeItemID int,
	@FoodTypeID int,
    @Date date,
    @HasOrderLimit bit,
	@HasEmployerShare bit, 
	@EmployerShareType tinyint,
	@EmployerShareValue decimal(30, 4),
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  	

    IF @Version <>
    (
        SELECT [Version]
        FROM HRM.FoodTypeItem
        WHERE FoodTypeItemID = @FoodTypeItemID
    )
	begin
		RAISERROR('Version mismatch...', 16, 10);
	end       	 

	UPDATE HRM.FoodTypeItem
	SET    [Date] = @Date,
	       HasOrderLimit = @HasOrderLimit,
		   HasEmployerShare= @HasEmployerShare,
		   EmployerShareType = @EmployerShareType,
		   EmployerShareValue = @EmployerShareValue,
	       [Version] = @Version + 1, 
		   [LastEditor] = @LastEditor, 
		   [LastEditionDate] = @LastEditionDate
	WHERE  FoodTypeItemID = @FoodTypeItemID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version]
	FROM   HRM.FoodTypeItem
	WHERE  FoodTypeItemID = @FoodTypeItemID
	-- End Return Select <- do not remove
