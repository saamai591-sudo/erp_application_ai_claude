
------------------------------------- END #9642

------------------------------------- START #7029
CREATE   PROCEDURE Pay.GetParameterOrder(@orderType INT)
AS
BEGIN
	
	IF(@orderType = 2)--MonthlyData
	BEGIN 
			declare @ParameterTypeID INT
			select @ParameterTypeID = ParameterTypeID 
			from [PAY].[ParameterType] 
			where EngName='ManualInput'
	END 
	
	SELECT p.ParameterID AS Value,
	       ISNULL(po.OrderIndex, 10000) AS Value1,
	         p.Title AS Value2
	FROM   pay.Parameter                 AS p
	INNER JOIN [PAY].[ParameterType] AS [pt] 
			ON [p].[ParameterTypeID] = [pt].[ParameterTypeID]
	LEFT JOIN (select  * from pay.ParameterOrder
	                  WHERE OrderType=@orderType ) po
	ON  po.ParameterID = p.ParameterID
	WHERE  @orderType = 1 OR 
	(@orderType=0 AND p.ParameterTypeID=4) OR
	(@orderType=2 AND p.ParameterTypeID = @ParameterTypeID)
	ORDER BY ISNULL(po.OrderIndex, 10000)
END;
